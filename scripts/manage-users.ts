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
import { createUser, removeUser, changePassword, listUsers } from '../lib/users';
import { getNotesRoot, userRootFor } from '../lib/fsHelpers';
import { createInterface } from 'readline';

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

async function promptPassword(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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
        password = await promptPassword('Passwort: ');
        if (password.length === 0) {
          console.error('Fehler: Passwort darf nicht leer sein.');
          process.exit(1);
        }
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

      const password = await promptPassword('Neues Passwort: ');
      if (password.length === 0) {
        console.error('Fehler: Passwort darf nicht leer sein.');
        process.exit(1);
      }

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
  console.error('Fehler:', err instanceof Error ? err.message : err);
  process.exit(1);
});
