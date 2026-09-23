import { test, expect, type Page } from '@playwright/test';
import { deleteAllTodos } from './helpers';
import { boxOf } from './geometry';
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

const SEED_TITLES = ['Erste', 'Zweite', 'Dritte'];

/** Three todos in Eingang, created in order. */
async function seedInbox(page: Page): Promise<void> {
  for (const title of SEED_TITLES) {
    await addToInbox(page, title);
  }
}

function inboxCards(page: Page) {
  return column(page, INBOX_META.label).locator('[data-todo-id]');
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

test.describe('Todo board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/todos');
    await deleteAllTodos(page);
    await page.goto('/todos');
  });

  test('shows exactly three columns', async ({ page }) => {
    for (const meta of TODO_COLUMN_META) {
      await expect(page.getByText(meta.label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator('[data-slot="card"]')).toHaveCount(TODO_COLUMN_META.length);

    // The old model's two planning columns are gone without replacement.
    await expect(page.getByText('Einplanen', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Eingeplant', { exact: true })).toHaveCount(0);
  });

  /** Geometry, not visibility: `toBeVisible`/`toHaveCount` were true even when
   *  CardHeader's base `grid` broke the header into two rows and the counter landed
   *  below the title. Only the position of the two relative to each other detects that. */
  test('column header keeps counter and title on one row', async ({ page }) => {
    await addToInbox(page, 'Erste');
    await addToInbox(page, 'Zweite');

    const header = column(page, INBOX_META.label).locator('[data-slot="card-header"]');
    const title = await boxOf(header.locator('[data-slot="card-title"]'));
    const counter = await boxOf(header.getByText('2', { exact: true }));

    // Overlapping vertically means: one row. The horizontal axis is no use here — `ml-auto`
    // pushes the counter to the right even on a row of its own taking the full width,
    // so on that axis the broken variant looked exactly like the correct one.
    expect(counter.y).toBeLessThan(title.y + title.height);
    expect(title.y).toBeLessThan(counter.y + counter.height);
  });

  test('"Erledigen" locks as soon as 3 slots are taken', async ({ page }) => {
    for (let i = 1; i <= DO_LIMIT; i++) {
      await addToInbox(page, `Slot${String(i)}`);
      await moveToDo(page, `Slot${String(i)}`);
    }

    // Quick-add and the pencil of the full column are locked …
    const doColumn = column(page, DO_META.label);
    await expect(doColumn.getByPlaceholder(DO_FULL_PLACEHOLDER)).toBeDisabled();
    await expect(doColumn.getByRole('button', { name: ADD_DETAILED_LABEL })).toBeDisabled();

    // … and the dialog no longer offers "Erledigen".
    await addToInbox(page, 'Vierter');
    await page.getByText('Vierter').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').first().click();
    await expect(page.getByRole('option', { name: DO_META.label })).toBeDisabled();
  });

  test('checking moves to "Erledigt", unchecking with "Erledigen" full moves to "Eingang"', async ({ page }) => {
    await addToInbox(page, 'Wanderer');
    await moveToDo(page, 'Wanderer');
    await expect(column(page, DO_META.label).getByText('Wanderer')).toBeVisible();

    await column(page, DO_META.label).getByRole('checkbox').click();
    await expect(column(page, DONE_META.label).getByText('Wanderer')).toBeVisible();

    // Fill the slots with other todos while 'Wanderer' is done.
    for (let i = 1; i <= DO_LIMIT; i++) {
      await addToInbox(page, `Fueller${String(i)}`);
      await moveToDo(page, `Fueller${String(i)}`);
    }

    // Unchecking must not break the limit — the todo lands in "Eingang".
    await column(page, DONE_META.label).getByRole('checkbox').click();
    await expect(column(page, INBOX_META.label).getByText('Wanderer')).toBeVisible();
    await expect(column(page, DO_META.label).getByText('Wanderer')).toHaveCount(0);
  });

  test('unchecking with a free slot brings the todo back to "Erledigen"', async ({ page }) => {
    await addToInbox(page, 'Rueckkehrer');
    await moveToDo(page, 'Rueckkehrer');
    await column(page, DO_META.label).getByRole('checkbox').click();
    await expect(column(page, DONE_META.label).getByText('Rueckkehrer')).toBeVisible();

    await column(page, DONE_META.label).getByRole('checkbox').click();
    await expect(column(page, DO_META.label).getByText('Rueckkehrer')).toBeVisible();
  });

  test('clearing "Erledigt" moves to the trash', async ({ page }) => {
    await addToInbox(page, 'Fertig');
    await column(page, INBOX_META.label).getByRole('checkbox').click();
    await expect(column(page, DONE_META.label).getByText('Fertig')).toBeVisible();

    await column(page, DONE_META.label).getByRole('button', { name: new RegExp(CLEAR_DONE_LABEL) }).click();
    await expect(page.getByText('Fertig')).toHaveCount(0);

    // Soft delete: restorable, nothing is lost.
    const trash = await page.request.get('/api/trash');
    const body = (await trash.json()) as { todos: { title: string }[] };
    expect(body.todos.map((t) => t.title)).toContain('Fertig');
  });

  test('the rules block expands and collapses', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Regeln' });
    await expect(page.getByText(/3-Slot-Regel/)).toHaveCount(0);

    await trigger.click();
    await expect(page.getByText(/3-Slot-Regel/)).toBeVisible();

    await trigger.click();
    await expect(page.getByText(/3-Slot-Regel/)).toHaveCount(0);
  });

  /** The manual Eingang order. The board's drag & drop is native HTML5, which Playwright
   *  cannot drive — the pointer geometry is covered by lib/todoOrder.test.ts. What is
   *  asserted here is the rest of the chain: schema, API, pull, merge and comparator. */
  test('new todos land at the bottom of Eingang, in creation order', async ({ page }) => {
    await seedInbox(page);

    await page.reload();
    const titles = await inboxCards(page).allInnerTexts();
    expect(titles.map((t) => t.split('\n')[0].trim())).toEqual(SEED_TITLES);
  });

  /** The marker slot is a layout element, so it needs geometry, not just visibility:
   *  it sits between every pair of cards and sets their spacing. */
  test('the drop marker reserves its slot between cards', async ({ page }) => {
    await seedInbox(page);

    const cards = inboxCards(page);
    const first = await boxOf(cards.nth(0));
    const second = await boxOf(cards.nth(1));
    const gap = second.y - (first.y + first.height);
    expect(gap).toBeGreaterThanOrEqual(3);
    expect(gap).toBeLessThanOrEqual(5);
  });

  test('a written order decides the rendered sequence', async ({ page }) => {
    await seedInbox(page);

    const lastId = await inboxCards(page).last().getAttribute('data-todo-id');
    // Rank 1 is below every createdAt fallback, so this row must sort to the top.
    const response = await page.request.put(`/api/todos/${String(lastId)}`, { data: { order: 1 } });
    expect(response.ok()).toBe(true);

    await page.reload();
    await expect(inboxCards(page).first()).toContainText(SEED_TITLES[2]);
  });
});
