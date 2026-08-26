import { test, expect, type Locator, type Page } from '@playwright/test';
import { CANCEL_LABEL, CREATE_LABEL, DEFAULT_NOTE_TITLE, FAILED_SYNC_TAG, NEW_FOLDER_LABEL } from '../../lib/constants';
import {
  FOLDER_NAME_PLACEHOLDER,
  FOLDER_PATH_HINT_PREFIX,
  FOLDER_RESERVED_HINT,
  FOLDER_ROOT_DESCRIPTION,
  folderParentDescription,
  folderPathHint,
} from '../../lib/tagConstants';
import { createNoteWithTag, deleteAllNotes, watchForHydrationErrors } from './helpers';
import { currentLabel } from './tagLocators';

// The sidebar's folder button is the second entry into `createTagFolder`; the command palette's
// `@` mode is the first and is covered in command-palette.spec.ts. Only this one prefixes the
// typed name with the folder currently being browsed (AppSidebar.handleCreateFolder), which is
// what most of the file below is about.

// Typed with a capital, asserted lowercase: normalizeTagPath lowercases every segment, and the
// live preview is the only place a user sees that before committing.
const ROOT_FOLDER_INPUT = 'Notizen';
const ROOT_FOLDER = 'notizen';

// The folder a note is filed under before the second folder is created inside it.
const PARENT_FOLDER = 'arbeit';
// One input carrying every normalization rule at once: leading/trailing spaces, spaces around
// the separator, capitals, and two segments from a single typed string.
const NESTED_INPUT = ' Projekte / 2026 ';
const NESTED_PATH = `${PARENT_FOLDER}/projekte/2026`;
const NESTED_LEAF = '2026';

// Derived, not spelled out: the reserved name is FAILED_SYNC_TAG, and upper-casing it also
// proves the check runs on the *normalized* value rather than on the raw input.
const RESERVED_INPUT = FAILED_SYNC_TAG.toUpperCase();

/** The sidebar footer's folder button. Icon-only — its accessible name comes from `title`
 *  alone. `NEW_FOLDER_LABEL` is on the page twice while the dialog is open (button title and
 *  DialogTitle), so this must stay a role query: a getByText would match both. */
function newFolderButton(page: Page): Locator {
  return page.getByRole('button', { name: NEW_FOLDER_LABEL, exact: true });
}

function folderDialog(page: Page): Locator {
  return page.getByRole('dialog');
}

/** The name field. It carries no label and no aria-label — the placeholder is all there is. */
function folderNameInput(page: Page): Locator {
  return page.getByPlaceholder(FOLDER_NAME_PLACEHOLDER);
}

function submitButton(page: Page): Locator {
  return folderDialog(page).getByRole('button', { name: CREATE_LABEL, exact: true });
}

/** Any rendered path preview, whatever path it names. `getByText` matches by substring, so a
 *  count of 0 on the bare prefix rules out *every* preview — a probe carrying a concrete path
 *  would only rule out that one. */
function anyPathHint(page: Page): Locator {
  return folderDialog(page).getByText(FOLDER_PATH_HINT_PREFIX);
}

/** Open the dialog from the sidebar and wait until it is really there. */
async function openFolderDialog(page: Page): Promise<Locator> {
  await newFolderButton(page).click();
  const dialog = folderDialog(page);
  await expect(dialog).toBeVisible();

  return dialog;
}

test.describe('Neuer Ordner (Sidebar)', () => {
  let hydrationErrors: string[];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto('/notes');
    // A clean tag tree: createNoteWithTag needs no suggestion dropdown swallowing its Enter,
    // and every folder name below is then unique on the page.
    await deleteAllNotes(page);
    await page.reload();
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  test('legt auf oberster Ebene an und springt in den neuen Ordner', async ({ page }) => {
    const dialog = await openFolderDialog(page);
    await expect(dialog.getByText(FOLDER_ROOT_DESCRIPTION)).toBeVisible();

    await folderNameInput(page).fill(ROOT_FOLDER_INPUT);
    // No parent prefix, and already lowercased.
    await expect(dialog.getByText(folderPathHint(ROOT_FOLDER))).toBeVisible();

    await submitButton(page).click();

    await expect(page).toHaveURL(/\/notes\/[^/]+$/);
    // The dialog promises "Eine erste Notiz wird darin angelegt" — this is that note.
    await expect(page.locator('#note-title')).toHaveValue(DEFAULT_NOTE_TITLE, { timeout: 15_000 });
    await expect(currentLabel(page, ROOT_FOLDER)).toHaveText(ROOT_FOLDER, { timeout: 15_000 });
  });

  // The branch the palette can never reach: there, the user types the whole path. Here the
  // active folder is prepended, and a note with a *different* tag is necessarily open while it
  // happens — which is also the only way to run `createTagFolder`'s jump-first-create-second
  // ordering against a competing tag sync.
  test('legt unter dem aktiven Ordner an, normalisiert, und bleibt dort', async ({ page }) => {
    await createNoteWithTag(page, 'Arbeitsnotiz', 'Inhalt.', PARENT_FOLDER);
    // The sidebar follows the note into its folder once the note gains its first tag. Clicking
    // before this lands would find folderParent still empty and silently test the root branch.
    await expect(currentLabel(page, PARENT_FOLDER)).toHaveText(PARENT_FOLDER, { timeout: 15_000 });

    const dialog = await openFolderDialog(page);
    // The only place the user is told which parent the typed name will hang under.
    await expect(dialog.getByText(folderParentDescription(PARENT_FOLDER))).toBeVisible();

    await folderNameInput(page).fill(NESTED_INPUT);
    await expect(dialog.getByText(folderPathHint(NESTED_PATH))).toBeVisible();

    await submitButton(page).click();

    await expect(page).toHaveURL(/\/notes\/[^/]+$/);
    // Preview and result agree, and the parent really was prepended.
    await expect(currentLabel(page, NESTED_PATH)).toHaveText(NESTED_LEAF, { timeout: 15_000 });

    // The new note's title only appears once `pathname` is already /notes/<new> and that page
    // has rendered — and that pathname change is exactly the input useTagStateSync re-derives
    // `currentTagPath` from (getNoteTagPath). So the re-check below sits provably *after* the
    // sync that could pull the sidebar back to `arbeit`, not merely later on the clock.
    await expect(page.locator('#note-title')).toHaveValue(DEFAULT_NOTE_TITLE, { timeout: 15_000 });
    await expect(currentLabel(page, NESTED_PATH)).toHaveText(NESTED_LEAF);
  });

  // Two independent gates gone through separately: `disabled` on the button, and the
  // `if (!canSubmit) return` inside handleSubmit that Enter has to hit, because Enter never
  // touches the button at all.
  test('lässt nicht durch, was kein Tag werden darf', async ({ page }) => {
    const dialog = await openFolderDialog(page);
    const input = folderNameInput(page);

    // Empty: no hint paragraph exists at all — it renders only once the normalized name is
    // non-empty, so there is nothing yet to be right or wrong about.
    await expect(submitButton(page)).toBeDisabled();
    await expect(anyPathHint(page)).toHaveCount(0);
    await expect(dialog.getByText(FOLDER_RESERVED_HINT)).toHaveCount(0);

    // Normalizes to '' as well, so it must look exactly like the empty case.
    await input.fill('/');
    await expect(submitButton(page)).toBeDisabled();
    await expect(anyPathHint(page)).toHaveCount(0);

    await input.fill(RESERVED_INPUT);
    await expect(dialog.getByText(FOLDER_RESERVED_HINT)).toBeVisible();
    await expect(anyPathHint(page)).toHaveCount(0);
    await expect(submitButton(page)).toBeDisabled();

    // The second gate. `disabled` cannot help here — the keypress goes to the input, never to
    // the button. Asserted on the field's *value*, not on the dialog still being on screen:
    // handleSubmit clears the field and closes the dialog in one commit, and Radix keeps the
    // closing dialog mounted through its exit animation, so "still visible" is true for ~150ms
    // either way and proves nothing. The field still holding what was typed is state, not
    // animation — it is only true if handleSubmit really returned early.
    await input.press('Enter');
    await expect(input).toHaveValue(RESERVED_INPUT);
    await expect(dialog.getByText(FOLDER_RESERVED_HINT)).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();

    // And the rejection does not stick.
    await input.fill('Archiv');
    await expect(submitButton(page)).toBeEnabled();
    await expect(dialog.getByText(folderPathHint('archiv'))).toBeVisible();
    await expect(dialog.getByText(FOLDER_RESERVED_HINT)).toHaveCount(0);

    // The durable proof, last on purpose — same reasoning as the cancel test below: by now
    // several UI round trips have gone by, so a create that the Enter should never have
    // started would long since have landed as a POST.
    const res = await page.request.get('/api/notes');
    expect(res.ok(), `GET /api/notes failed: ${res.status().toString()}`).toBe(true);
    expect((await res.json()) as unknown[]).toHaveLength(0);
  });

  test('Abbrechen legt nichts an und lässt kein Feld stehen', async ({ page }) => {
    await openFolderDialog(page);
    await folderNameInput(page).fill('Verworfen');
    await folderDialog(page).getByRole('button', { name: CANCEL_LABEL, exact: true }).click();
    await expect(folderDialog(page)).toHaveCount(0);

    // The reset lives in onOpenChange, so the next open is the only place it shows.
    await openFolderDialog(page);
    await expect(folderNameInput(page)).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(folderDialog(page)).toHaveCount(0);

    // Last on purpose. "Nothing was created" is a negative claim, and every retrying assertion
    // waits in the wrong direction for it — but by now two full open/close rounds have gone by,
    // so a create triggered back at the cancel would long since have landed as a POST.
    const res = await page.request.get('/api/notes');
    expect(res.ok(), `GET /api/notes failed: ${res.status().toString()}`).toBe(true);
    expect((await res.json()) as unknown[]).toHaveLength(0);
  });
});
