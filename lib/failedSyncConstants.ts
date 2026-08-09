// German UI strings for the failed-sync inspector (single-sourced, never inlined
// in components). Own module because lib/constants.ts is at its 200-line cap —
// same precedent as lib/ttsConstants.ts.
import { SYNC_MAX_RETRIES } from './constants';
import type { SyncAction, SyncEntityType } from './types';

// --- Indicator + dialog shell ---
export const FAILED_SYNC_OPEN_LABEL = 'Nicht übertragene Änderungen anzeigen';
export const FAILED_SYNC_DIALOG_TITLE = 'Nicht übertragene Änderungen';
export const FAILED_SYNC_DIALOG_DESCRIPTION =
  'Diese Änderungen liegen nur auf diesem Gerät. Prüfe Inhalt und Speicherort, bevor du sie verwirfst.';
export const FAILED_SYNC_EMPTY = 'Alle Änderungen sind übertragen.';
export const FAILED_SYNC_CLOSE_LABEL = 'Schließen';
export const FAILED_SYNC_OFFLINE_SUFFIX = 'Offline';

export function failedSyncEntriesLabel(count: number): string {
  return count === 1 ? 'Eintrag' : 'Einträge';
}

export function failedSyncChangesLabel(count: number): string {
  return count === 1 ? 'nicht übertragene Änderung' : 'nicht übertragene Änderungen';
}

export function failedSyncIndicatorTitle(count: number, isOnline: boolean): string {
  const base = `${count.toString()} ${failedSyncChangesLabel(count)} — klicken für Details`;
  return isOnline ? base : `${FAILED_SYNC_OFFLINE_SUFFIX} — ${base}`;
}

// --- Per-entry actions ---
export const FAILED_SYNC_OPEN_NOTE_LABEL = 'Notiz öffnen';
export const FAILED_SYNC_OPEN_TODOS_LABEL = 'In den Aufgaben anzeigen';
// The two directions the inspector resolves an entry in. Both end with local and
// server agreeing — a plain "retry" could dead-end forever on a 404, leaving the
// user to copy the text out and re-create the note by hand.
export const FAILED_SYNC_PUSH_LABEL = 'Auf Server hochladen';
export const FAILED_SYNC_PUSH_RUNNING = 'Übertragung läuft…';
// Deliberately promises nothing: the offline branch enqueues NOTHING, and a
// recorded failure lives in notizen:sync-failed, which processSyncQueue never
// reads. Reconnecting alone uploads it only if the user asks again.
export const FAILED_SYNC_PUSH_OFFLINE = 'Offline — Hochladen ist erst mit Verbindung möglich.';

export const FAILED_SYNC_PUSH_QUEUED = 'Wird auf den Server übertragen.';
export const FAILED_SYNC_PUSH_RECREATED = 'Die Notiz wird auf dem Server neu angelegt.';
export const FAILED_SYNC_PUSH_RESTORED = 'Aus dem Papierkorb wiederhergestellt und wird übertragen.';
export const FAILED_SYNC_PUSH_UNDECIDABLE =
  'Der Papierkorb konnte nicht geprüft werden — bitte später erneut hochladen.';
export const FAILED_SYNC_PUSH_NOTHING = 'Es ist kein lokaler Inhalt vorhanden, der hochgeladen werden könnte.';
export const FAILED_SYNC_PUSH_ERROR = 'Hochladen fehlgeschlagen.';
// Shown when the upload was a no-op: a background drain resolved the entry, or a
// newer change for it is already waiting.
export const FAILED_SYNC_PUSH_SKIPPED = 'Nicht nötig — für diesen Eintrag läuft schon eine Übertragung.';
export const FAILED_SYNC_COPY_LABEL = 'Inhalt kopieren';
export const FAILED_SYNC_COPY_DONE = 'Inhalt wurde kopiert.';
export const FAILED_SYNC_COPY_ERROR = 'Kopieren nicht möglich — Text bitte im Feld markieren.';
// The other direction: local gives way to the server. Named for the effect the
// user cares about, not for the queue mechanics.
export const FAILED_SYNC_DISCARD_LABEL = 'Lokal löschen';
export const FAILED_SYNC_DISCARD_OFFLINE_HINT =
  'Der Server-Stand ist offline nicht verfügbar; die Notiz öffnet bis zur nächsten Verbindung leer.';
// Per-entry discard deletes the ONLY copy of the unsynced text (cache, draft and
// list row) and the server never received it — and the button sits two icons from
// "Erneut versuchen". So it confirms in place, the same two-step pattern the
// footer uses, rather than destroying content on a single stray click.
export const FAILED_SYNC_DISCARD_QUESTION = 'Lokalen Stand löschen und den Server übernehmen?';
// Must differ from FAILED_SYNC_DISCARD_LABEL (the arming button) and from
// FAILED_SYNC_DISCARD_ALL_CONFIRM: identical accessible names on two buttons that
// can be on screen together are ambiguous to screen readers and to any query.
export const FAILED_SYNC_DISCARD_CONFIRM_LABEL = 'Lokal endgültig löschen';

// --- Discard all (two-step footer inside the inspector) ---
export const FAILED_SYNC_DISCARD_ALL_LABEL = 'Alle verwerfen';
export const FAILED_SYNC_DISCARD_ALL_CONFIRM = 'Endgültig löschen';
export const FAILED_SYNC_DISCARD_ALL_WARNING =
  'Lokale Änderungen, die nicht übertragen werden konnten, gehen dabei verloren.';

export function failedSyncDiscardAllQuestion(count: number): string {
  return `${count.toString()} ${failedSyncEntriesLabel(count)} endgültig verwerfen?`;
}

// --- Field labels ---
export const FAILED_SYNC_LABEL_LOCATION = 'Speicherort';
export const FAILED_SYNC_LABEL_FOLDER = 'Ordner';
export const FAILED_SYNC_LABEL_CHANGED_AT = 'Geändert am';
export const FAILED_SYNC_LABEL_FAILED_AT = 'Fehlgeschlagen am';
export const FAILED_SYNC_LABEL_ATTEMPTS = 'Versuche';
export const FAILED_SYNC_LABEL_SERVER_MESSAGE = 'Servermeldung';
export const FAILED_SYNC_LABEL_CONTENT = 'Inhalt';
export const FAILED_SYNC_NO_FOLDER = 'Kein Ordner';
export const FAILED_SYNC_LOCATION_LOCAL = 'Nur auf diesem Gerät';
export const FAILED_SYNC_TODOS_FILE = 'todos.json';
export const FAILED_SYNC_NO_CONTENT = 'Diese Änderung enthielt keinen Text (nur Metadaten).';
export const FAILED_SYNC_CONTENT_UNKNOWN = 'Der Inhalt liegt lokal nicht mehr vor.';
export const FAILED_SYNC_KEEP_LOCAL_HINT =
  'Der lokale Stand bleibt bis zum Verwerfen auf diesem Gerät erhalten.';

// --- Badges ---
export const FAILED_SYNC_ENTITY_LABEL: Record<SyncEntityType, string> = {
  note: 'Notiz',
  todo: 'Aufgabe',
};

export const FAILED_SYNC_ACTION_LABEL: Record<SyncAction, string> = {
  create: 'Neu angelegt',
  update: 'Bearbeitet',
  delete: 'Gelöscht',
};

// --- Causes (derived from the HTTP status, never from the raw server body) ---
// Partial: an arbitrary status must type as a miss, so the lookup guard in
// describeFailureCause stays meaningful rather than reading as dead code.
export const FAILED_SYNC_CAUSE_BY_STATUS: Partial<Record<number, string>> = {
  400: 'Der Server hat die Daten als ungültig abgelehnt.',
  401: 'Die Sitzung war abgelaufen.',
  403: 'Für diese Änderung fehlt die Berechtigung.',
  409: 'Auf dem Server liegt eine neuere Version.',
  413: 'Die Änderung ist zu groß für den Server.',
  422: 'Der Server konnte die Daten nicht verarbeiten.',
  429: 'Der Server hat zu viele Anfragen abgewiesen.',
};

export const FAILED_SYNC_CAUSE_GONE: Record<SyncEntityType, string> = {
  note: 'Diese Notiz existiert auf dem Server nicht mehr.',
  todo: 'Diese Aufgabe existiert auf dem Server nicht mehr.',
};

export const FAILED_SYNC_CAUSE_SERVER = 'Der Server hat wiederholt mit einem Fehler geantwortet.';
// Gave up without ever receiving a response — distinct from a legacy entry whose
// cause simply was not recorded.
export const FAILED_SYNC_CAUSE_GAVE_UP = 'Die Übertragung wurde nach mehreren Versuchen aufgegeben.';
export const FAILED_SYNC_CAUSE_UNEXPECTED = 'Der Server hat mit einem unerwarteten Fehler geantwortet.';
export const FAILED_SYNC_CAUSE_NO_INFO = 'Die Ursache wurde nicht aufgezeichnet (älterer Eintrag).';
export const FAILED_SYNC_CAUSE_NOT_RECORDED = 'Konnte nicht aufgezeichnet werden — Speicher voll.';

// „Auf Server hochladen" re-creates a gone note under the same id (restoring it
// from the trash first when it is in there), so there is nothing left to do by hand.
export const FAILED_SYNC_HINT_GONE = '„Auf Server hochladen" legt sie mit dem lokalen Inhalt wieder an.';
export const FAILED_SYNC_HINT_RETRY = 'Ein erneuter Upload kann jetzt klappen.';
export const FAILED_SYNC_HINT_NOT_RECORDED = 'Gib Speicher frei und lade den Eintrag erneut hoch.';
export const FAILED_SYNC_REASON_NON_RETRYABLE = 'Sofort abgebrochen — ein erneuter Versuch war nicht sinnvoll.';
export const FAILED_SYNC_REASON_MAX_RETRIES = `Nach ${SYNC_MAX_RETRIES.toString()} Versuchen aufgegeben.`;
export const FAILED_SYNC_STATUS_PREFIX = 'HTTP-Status';

// --- Card marker (todos) ---
// Notes surface a failed sync through the synthetic FAILED_SYNC_TAG folder in
// the sidebar; todos have no sidebar entry, so the card itself carries the
// marker — otherwise the only hint is the count on the cloud icon.
export const FAILED_SYNC_CARD_LABEL = 'Nicht übertragen';
export const FAILED_SYNC_CARD_TOOLTIP =
  'Diese Aufgabe liegt nur auf diesem Gerät. Details über das Wolken-Symbol in der Seitenleiste.';

// --- Todo detail rows ---
export const FAILED_SYNC_TODO_QUADRANT = 'Quadrant';
export const FAILED_SYNC_TODO_DUE = 'Fällig am';
export const FAILED_SYNC_TODO_COMPLETED = 'Erledigt';
export const FAILED_SYNC_YES = 'Ja';
export const FAILED_SYNC_NO = 'Nein';
