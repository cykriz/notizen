#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Read-only migration report for the move from the four-quadrant Eisenhower board
 * to the three-column Kanban (Eingang / Erledigen / Erledigt).
 *
 * Run it BEFORE the app touches the data: reading todos.json through the app
 * self-heals the file on the next write, and then there is nothing left to count.
 *
 * Usage:
 *   NOTES_ROOT=/path/to/data bun scripts/todo-migration-report.ts [username]
 *
 * Without a username every user under NOTES_ROOT/users is reported. Writes nothing.
 */

import fs from 'fs/promises';
import path from 'path';
import { USERS_DATA_DIR } from '../lib/constants';
import { getNotesRoot, userRootFor } from '../lib/fsHelpers';
import { toUsableQuadrant } from '../lib/quadrantAlias';
import { DO_LIMIT, TODO_COLUMN, TODO_COLUMN_META, columnOf, enforceDoLimit } from '../lib/todoColumns';
import type { Todo } from '../lib/types';

const RETIRED_LABELS: Record<string, string> = { schedule: 'Einplanen', planned: 'Eingeplant' };

// todos.json is read through an unvalidated cast everywhere in the app, so on disk
// `quadrant` really is an arbitrary string — including the retired values this
// report exists to count. Typing it as TodoQuadrant here would hide exactly those.
type RawTodo = Omit<Todo, 'quadrant'> & { quadrant: string };

async function readRaw(root: string): Promise<RawTodo[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(root, 'todos.json'), 'utf-8')) as RawTodo[];
  } catch {
    return [];
  }
}

async function listUsernames(): Promise<string[]> {
  const dir = path.join(getNotesRoot(), USERS_DATA_DIR);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function report(username: string, raw: RawTodo[]): void {
  const active = raw.filter((t) => t.trashedAt === undefined);

  // Same functions the app uses — no second implementation of the rules.
  const rescued: Todo[] = active.map((t) => ({ ...t, quadrant: toUsableQuadrant(t.quadrant) }));
  const migrated = enforceDoLimit(rescued);

  const fromRetired = active.filter((t) => Object.hasOwn(RETIRED_LABELS, t.quadrant));
  const demoted = migrated.filter((t, i) => t.quadrant !== rescued[i].quadrant);
  const withDue = active.filter((t) => t.dueDate !== undefined && t.dueDate !== '');

  console.log(`\n=== ${username} — ${String(active.length)} aktive Aufgaben ===`);

  for (const [value, label] of Object.entries(RETIRED_LABELS)) {
    const n = fromRetired.filter((t) => t.quadrant === value).length;
    console.log(`  ${label} → Eingang: ${String(n)}`);
  }

  console.log(`  Erledigen-Überhang → Eingang (max. ${String(DO_LIMIT)}): ${String(demoted.length)}`);
  for (const t of demoted) {
    console.log(`      – ${t.title}`);
  }

  console.log('  Spalten danach:');
  for (const meta of TODO_COLUMN_META) {
    const n = migrated.filter((t) => columnOf(t) === meta.key).length;
    console.log(`      ${meta.icon} ${meta.label}: ${String(n)}`);
  }

  // The due-date field disappears from the UI with this rebuild. Surface the rows
  // that still carry one so they can go into the calendar before they go invisible.
  if (withDue.length > 0) {
    console.log(`  ⚠️  Noch mit Fälligkeitsdatum (verschwindet aus der Ansicht): ${String(withDue.length)}`);
    for (const t of withDue) {
      console.log(`      – ${String(t.dueDate)}  ${t.title}`);
    }
  }

  const open = migrated.filter((t) => columnOf(t) !== TODO_COLUMN.DONE).length;
  console.log(`  Offen: ${String(open)}, davon in Erledigen: ${String(migrated.filter((t) => columnOf(t) === TODO_COLUMN.DO).length)}`);
}

const arg = process.argv.slice(2).at(0);
const usernames = arg !== undefined && arg !== '' ? [arg] : await listUsernames();

if (usernames.length === 0) {
  console.error(`Keine Benutzer unter ${path.join(getNotesRoot(), USERS_DATA_DIR)} gefunden.`);
  process.exit(1);
}

for (const username of usernames) {
  report(username, await readRaw(userRootFor(username)));
}
console.log('\nNichts geschrieben — reiner Trockenlauf.\n');
