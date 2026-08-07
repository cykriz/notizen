import { describe, expect, test } from 'bun:test';

import {
  FAILED_SYNC_OFFLINE_SUFFIX,
  failedSyncChangesLabel,
  failedSyncDiscardAllQuestion,
  failedSyncEntriesLabel,
  failedSyncIndicatorTitle,
} from './failedSyncConstants';

// German plurals in generated strings had no coverage at all, which is how
// "1 nicht übertragene Änderungen" shipped. These are pure functions, so the
// cheapest possible guard.
describe('German singular/plural', () => {
  test('one change is singular', () => {
    expect(failedSyncChangesLabel(1)).toBe('nicht übertragene Änderung');
  });

  test('more than one is plural', () => {
    expect(failedSyncChangesLabel(2)).toBe('nicht übertragene Änderungen');
    expect(failedSyncChangesLabel(0)).toBe('nicht übertragene Änderungen');
  });

  test('entry label follows the same rule', () => {
    expect(failedSyncEntriesLabel(1)).toBe('Eintrag');
    expect(failedSyncEntriesLabel(2)).toBe('Einträge');
  });
});

describe('failedSyncIndicatorTitle', () => {
  test('a single failure reads singular', () => {
    const title = failedSyncIndicatorTitle(1, true);
    expect(title).toStartWith('1 nicht übertragene Änderung —');
    expect(title).not.toContain('Änderungen');
  });

  test('several failures read plural', () => {
    expect(failedSyncIndicatorTitle(3, true)).toStartWith('3 nicht übertragene Änderungen —');
  });

  test('offline is announced up front, since the icon changes too', () => {
    const title = failedSyncIndicatorTitle(1, false);
    expect(title).toStartWith(FAILED_SYNC_OFFLINE_SUFFIX);
    expect(title).toContain('1 nicht übertragene Änderung');
  });

  test('online does not mention offline', () => {
    expect(failedSyncIndicatorTitle(1, true)).not.toContain(FAILED_SYNC_OFFLINE_SUFFIX);
  });
});

describe('failedSyncDiscardAllQuestion', () => {
  test('agrees with the count', () => {
    expect(failedSyncDiscardAllQuestion(1)).toBe('1 Eintrag endgültig verwerfen?');
    expect(failedSyncDiscardAllQuestion(4)).toBe('4 Einträge endgültig verwerfen?');
  });
});
