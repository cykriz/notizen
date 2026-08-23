#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * User management CLI for Notizen auth.
 *
 * Usage:
 *   bun run user add <username>            # prompts for password
 *   bun run user add <username> <password> # direct (warns about shell history)
 *   bun run user list
 *   bun run user remove <username>
 *   bun run user passwd <username>         # prompts for new password
 */

import fs from 'fs/promises';
import path from 'path';
import { createUser, removeUser, changePassword, listUsers, PASSWORD_MIN_LENGTH } from '../lib/users';
import { getNotesRoot, userRootFor } from '../lib/fsHelpers';
import { PasswordPromptAborted, isInteractive, promptPassword } from './promptPassword';

const [command, ...args] = process.argv.slice(2);

function usage(): never {
  console.log('Usage:');
  console.log('  bun run user add <username> [password]');
  console.log('  bun run user list');
  console.log('  bun run user remove <username>');
  console.log('  bun run user passwd <username>');
  console.log('  bun run user migrate <username>');
  process.exit(1);
}

const CONFIRM_ATTEMPTS = 3;

/** Without an echo a typo is invisible, so a terminal gets a confirmation prompt
 *  — and more than one try, because mistyping input you cannot see is the normal
 *  case, not an error worth aborting the whole command for. Piped input is
 *  scripted: nothing to mistype, and a second read would only hit EOF. */
async function promptNewPassword(prompt: string): Promise<string> {
  if (!isInteractive()) {
    return await promptPassword(prompt);
  }

  for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS; attempt++) {
    const password = await promptPassword(prompt);

    // Checked here only so the length is not learned *after* typing an invisible
    // password twice. `createUser`/`changePassword` stay the enforcing gate —
    // every other caller still has to pass it.
    if (password.length < PASSWORD_MIN_LENGTH) {
      console.error(`Passwort zu kurz: mindestens ${String(PASSWORD_MIN_LENGTH)} Zeichen.`);
      continue;
    }

    if (await promptPassword('Wiederholen: ') === password) {
      return password;
    }

    if (attempt < CONFIRM_ATTEMPTS) {
      console.error('Passwörter stimmen nicht überein. Nochmal.');
    }
  }

  throw new Error('Passwort nicht gesetzt: zu kurz oder nicht bestätigt.');
}

async function main() {
  switch (command) {
    case 'add': {
      const username = args[0] as string | undefined;
      if (username === undefined || username === '') {
        usage();
      }

      let password = args[1] as string | undefined;
      if (password !== undefined && password !== '') {
        console.warn('Warnung: Passwort ist in der Shell-History sichtbar.');
      } else {
        password = await promptNewPassword('Passwort: ');
      }

      await createUser(username, password);
      console.log(`Benutzer "${username}" erstellt.`);
      break;
    }

    case 'list': {
      const users = await listUsers();
      if (users.length === 0) {
        console.log('Keine Benutzer vorhanden.');
      } else {
        for (const u of users) {
          console.log(`  ${u}`);
        }
      }

      break;
    }

    case 'remove': {
      const username = args[0] as string | undefined;
      if (username === undefined || username === '') {
        usage();
      }

      await removeUser(username);
      console.log(`Benutzer "${username}" entfernt. Daten bleiben erhalten.`);
      break;
    }

    case 'passwd': {
      const username = args[0] as string | undefined;
      if (username === undefined || username === '') {
        usage();
      }

      const password = await promptNewPassword('Neues Passwort: ');
      await changePassword(username, password);
      console.log(`Passwort fuer "${username}" geaendert.`);
      break;
    }

    case 'migrate': {
      const username = args[0] as string | undefined;
      if (username === undefined || username === '') {
        usage();
      }

      const users = await listUsers();
      if (!users.includes(username)) {
        console.error(`Fehler: Benutzer "${username}" existiert nicht.`);
        process.exit(1);
      }

      const root = getNotesRoot();
      const target = userRootFor(username);
      const notesSource = path.join(root, 'notes');
      const todosSource = path.join(root, 'todos.json');
      const notesTarget = path.join(target, 'notes');
      const todosTarget = path.join(target, 'todos.json');
      let moved = 0;

      try {
        const entries = await fs.readdir(notesSource, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());
        if (dirs.length > 0) {
          await fs.mkdir(notesTarget, { recursive: true });
          for (const dir of dirs) {
            await fs.rename(path.join(notesSource, dir.name), path.join(notesTarget, dir.name));
            moved++;
          }
        }
      } catch {
        // No notes directory — nothing to migrate
      }

      try {
        await fs.access(todosSource);
        await fs.mkdir(target, { recursive: true });
        await fs.rename(todosSource, todosTarget);
        console.log('todos.json verschoben.');
      } catch {
        // No todos.json — nothing to migrate
      }

      console.log(`${String(moved)} Notizen nach "${username}" verschoben.`);
      break;
    }

    default:
      usage();
  }
}

main().catch((err: unknown) => {
  // Ctrl-C or an empty stdin is not a failure of the command — report it as an
  // abort (128 + SIGINT) rather than dressing it up as an error.
  if (err instanceof PasswordPromptAborted) {
    console.error(err.message);
    process.exit(130);
  }

  console.error('Fehler:', err instanceof Error ? err.message : err);
  process.exit(1);
});
