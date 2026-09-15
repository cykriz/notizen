#!/usr/bin/env bun
/**
 * Language gate — keeps German out of developer-facing text.
 *
 * `CLAUDE.md` § Key Rules has said since forever that everything a developer reads is English, and the
 * rule was still missed at twelve places in the code and in thirty-seven test titles. The missing check
 * was the actual defect, so this is it. The predicate lives in `languageRules.ts`.
 *
 * Three modes:
 *   check-language.ts                 every git-tracked file (`bun run lint:lang`)
 *   check-language.ts --staged        the staged *index* content (pre-commit hook)
 *   check-language.ts --commit-msg F  one commit message (commit-msg hook)
 *
 * Files come from git, never from a directory walk: the repo root holds a gitignored German file
 * (`*.local.md`) that a walk would pick up, and the gate could then never go green. `--others` is
 * part of that listing on purpose — without it a newly added, still-untracked file is invisible, and
 * the gate reports clean having never looked at it.
 *
 * `--staged` reads `git show :<file>` rather than the worktree, so a partially staged German comment
 * cannot slip past the hook.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { type Hit, checkCommitMessage, checkMarkdown, checkSource } from './languageRules';

const SOURCE_EXT = /\.(ts|tsx)$/;

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function checkFile(path: string, content: string): Hit[] {
  if (SOURCE_EXT.test(path)) {
    return checkSource(path, content);
  }

  if (path.endsWith('.md')) {
    return checkMarkdown(content);
  }

  return [];
}

function report(path: string, hits: Hit[]): void {
  for (const hit of hits) {
    console.error(`${path}:${String(hit.line)}: German ("${hit.trigger}") — ${hit.text}`);
  }
}

function runCommitMsg(file: string): number {
  const hits = checkCommitMessage(readFileSync(file, 'utf8'));
  if (hits.length === 0) {
    return 0;
  }

  report(file, hits);
  console.error('\nCommit messages are English (CLAUDE.md § Key Rules).');
  console.error('German UI strings stay quotable: fix(ui): "Unbenannt" no longer overwritten');
  return 1;
}

function runFiles(staged: boolean): number {
  const listing = staged
    ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR')
    : git('ls-files', '--cached', '--others', '--exclude-standard');
  const paths = listing.split('\n').filter((p) => p !== '' && (SOURCE_EXT.test(p) || p.endsWith('.md')));

  let total = 0;
  for (const path of paths) {
    let content: string;
    try {
      content = staged ? git('show', `:${path}`) : readFileSync(path, 'utf8');
    } catch {
      continue; // deleted or unreadable — nothing to judge
    }
    const hits = checkFile(path, content);
    total += hits.length;
    report(path, hits);
  }

  if (total > 0) {
    console.error(`\n${String(total)} German passage(s) in developer-facing text (CLAUDE.md § Key Rules).`);
    console.error('German belongs in UI strings; quote it if a comment must cite UI copy.');
  }

  return total > 0 ? 1 : 0;
}

// `noUncheckedIndexedAccess` is off, so the destructured values type as `string` while being
// `undefined` at runtime — the arity is checked against argv itself rather than against the type.
const [mode, file] = process.argv.slice(2);

function run(): number {
  if (process.argv.length < 3) {
    return runFiles(false);
  }

  if (mode === '--staged') {
    return runFiles(true);
  }

  if (mode === '--commit-msg') {
    if (process.argv.length < 4) {
      console.error('--commit-msg needs the path of the message file');
      return 2;
    }

    return runCommitMsg(file);
  }

  // A typo must not fall through to a green full-repo scan — from inside a hook that reads as a pass.
  console.error(`unknown flag "${mode}" — expected --staged or --commit-msg <file>`);
  return 2;
}

process.exit(run());
