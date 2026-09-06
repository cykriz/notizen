import { test, expect, type Page } from '@playwright/test';
import { deleteAllTodos } from './helpers';
import {
  ADD_DETAILED_LABEL,
  CLEAR_DONE_LABEL,
  DO_FULL_PLACEHOLDER,
  DO_LIMIT,
  TODO_COLUMN_META,
} from '../../lib/todoColumns';

const [INBOX_META, DO_META, DONE_META] = TODO_COLUMN_META;

/** The quick-add footer of one column. Erledigt has none. */
function quickAdd(page: Page, label: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .getByPlaceholder(/Neue Aufgabe|Slots belegt/);
}

function column(page: Page, label: string) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText(label, { exact: true }) });
}

async function addToInbox(page: Page, title: string): Promise<void> {
  const input = quickAdd(page, INBOX_META.label);
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
}

/** Move a todo into Erledigen through the dialog — the keyboard path, and the one
 *  Playwright can drive reliably (the board's drag & drop is native HTML5). */
async function moveToDo(page: Page, title: string): Promise<void> {
  await page.getByText(title).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: DO_META.label }).click();
  await dialog.getByRole('button', { name: /Speichern/ }).click();
  await expect(dialog).toBeHidden();
}

test.describe('ToDo-Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/todos');
    await deleteAllTodos(page);
    await page.goto('/todos');
  });

  test('zeigt genau drei Spalten', async ({ page }) => {
    for (const meta of TODO_COLUMN_META) {
      await expect(page.getByText(meta.label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator('[data-slot="card"]')).toHaveCount(TODO_COLUMN_META.length);

    // Die beiden Planungsspalten des alten Modells sind ersatzlos weg.
    await expect(page.getByText('Einplanen', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Eingeplant', { exact: true })).toHaveCount(0);
  });

  test('Erledigen sperrt, sobald 3 Slots belegt sind', async ({ page }) => {
    for (let i = 1; i <= DO_LIMIT; i++) {
      await addToInbox(page, `Slot${String(i)}`);
      await moveToDo(page, `Slot${String(i)}`);
    }

    // Quick-Add und Stift der vollen Spalte sind gesperrt …
    const doColumn = column(page, DO_META.label);
    await expect(doColumn.getByPlaceholder(DO_FULL_PLACEHOLDER)).toBeDisabled();
    await expect(doColumn.getByRole('button', { name: ADD_DETAILED_LABEL })).toBeDisabled();

    // … und der Dialog bietet Erledigen nicht mehr an.
    await addToInbox(page, 'Vierter');
    await page.getByText('Vierter').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').first().click();
    await expect(page.getByRole('option', { name: DO_META.label })).toBeDisabled();
  });

  test('Abhaken schiebt nach Erledigt, Ent-Haken bei vollem Erledigen in den Eingang', async ({ page }) => {
    await addToInbox(page, 'Wanderer');
    await moveToDo(page, 'Wanderer');
    await expect(column(page, DO_META.label).getByText('Wanderer')).toBeVisible();

    await column(page, DO_META.label).getByRole('checkbox').click();
    await expect(column(page, DONE_META.label).getByText('Wanderer')).toBeVisible();

    // Slots mit anderen Aufgaben füllen, während 'Wanderer' erledigt ist.
    for (let i = 1; i <= DO_LIMIT; i++) {
      await addToInbox(page, `Fueller${String(i)}`);
      await moveToDo(page, `Fueller${String(i)}`);
    }

    // Ent-Haken darf das Limit nicht brechen — die Aufgabe landet im Eingang.
    await column(page, DONE_META.label).getByRole('checkbox').click();
    await expect(column(page, INBOX_META.label).getByText('Wanderer')).toBeVisible();
    await expect(column(page, DO_META.label).getByText('Wanderer')).toHaveCount(0);
  });

  test('Ent-Haken bei freiem Slot bringt die Aufgabe zurück nach Erledigen', async ({ page }) => {
    await addToInbox(page, 'Rueckkehrer');
    await moveToDo(page, 'Rueckkehrer');
    await column(page, DO_META.label).getByRole('checkbox').click();
    await expect(column(page, DONE_META.label).getByText('Rueckkehrer')).toBeVisible();

    await column(page, DONE_META.label).getByRole('checkbox').click();
    await expect(column(page, DO_META.label).getByText('Rueckkehrer')).toBeVisible();
  });

  test('Erledigt leeren verschiebt in den Papierkorb', async ({ page }) => {
    await addToInbox(page, 'Fertig');
    await column(page, INBOX_META.label).getByRole('checkbox').click();
    await expect(column(page, DONE_META.label).getByText('Fertig')).toBeVisible();

    await column(page, DONE_META.label).getByRole('button', { name: new RegExp(CLEAR_DONE_LABEL) }).click();
    await expect(page.getByText('Fertig')).toHaveCount(0);

    // Soft-Delete: wiederherstellbar, nichts geht verloren.
    const trash = await page.request.get('/api/trash');
    const body = (await trash.json()) as { todos: { title: string }[] };
    expect(body.todos.map((t) => t.title)).toContain('Fertig');
  });

  test('Regelblock klappt auf und zu', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Regeln' });
    await expect(page.getByText(/3-Slot-Regel/)).toHaveCount(0);

    await trigger.click();
    await expect(page.getByText(/3-Slot-Regel/)).toBeVisible();

    await trigger.click();
    await expect(page.getByText(/3-Slot-Regel/)).toHaveCount(0);
  });
});
