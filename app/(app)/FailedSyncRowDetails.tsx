'use client';

import {
  FAILED_SYNC_CONTENT_UNKNOWN,
  FAILED_SYNC_KEEP_LOCAL_HINT,
  FAILED_SYNC_LABEL_ATTEMPTS,
  FAILED_SYNC_LABEL_CHANGED_AT,
  FAILED_SYNC_LABEL_CONTENT,
  FAILED_SYNC_LABEL_FAILED_AT,
  FAILED_SYNC_LABEL_FOLDER,
  FAILED_SYNC_LABEL_LOCATION,
  FAILED_SYNC_LABEL_SERVER_MESSAGE,
  FAILED_SYNC_LOCATION_LOCAL,
  FAILED_SYNC_NO_CONTENT,
  FAILED_SYNC_NO_FOLDER,
} from '@/lib/failedSyncConstants';
import type { FailedSyncDetail } from '@/lib/failedSyncDetail';
import { formatDateTime } from '@/lib/utils';

interface FailedSyncRowDetailsProps {
  detail: FailedSyncDetail;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

export function FailedSyncRowDetails({ detail }: FailedSyncRowDetailsProps) {
  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2 text-xs">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <Row label={FAILED_SYNC_LABEL_LOCATION}>
          {detail.serverPath === null ? (
            <>
              {FAILED_SYNC_LOCATION_LOCAL}{' '}
              <code className="rounded bg-muted px-1 font-mono">{detail.localKey}</code>
            </>
          ) : (
            <code className="rounded bg-muted px-1 font-mono">{detail.serverPath}</code>
          )}
        </Row>

        <Row label={FAILED_SYNC_LABEL_FOLDER}>
          {detail.folders.length > 0 ? detail.folders.join(', ') : FAILED_SYNC_NO_FOLDER}
        </Row>

        <Row label={FAILED_SYNC_LABEL_CHANGED_AT}>{formatDateTime(detail.changedAt)}</Row>

        {detail.failedAt !== null && (
          <Row label={FAILED_SYNC_LABEL_FAILED_AT}>{formatDateTime(detail.failedAt)}</Row>
        )}

        {detail.attempts !== null && (
          <Row label={FAILED_SYNC_LABEL_ATTEMPTS}>{detail.attempts}</Row>
        )}

        {detail.fields.map((field) => (
          <Row key={field.label} label={field.label}>
            {field.value}
          </Row>
        ))}

        {detail.cause.statusText !== null && (
          <Row label={FAILED_SYNC_LABEL_SERVER_MESSAGE}>
            <span className="text-muted-foreground">
              {detail.cause.statusText}
              {detail.cause.detail !== null ? ` — ${detail.cause.detail}` : ''}
            </span>
          </Row>
        )}
      </dl>

      {/* The actionable half of the diagnosis — for a 404 it is the only thing
          the user can still do, so it must not stay buried in the view model. */}
      {detail.cause.hint !== null && <p className="text-muted-foreground">{detail.cause.hint}</p>}

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">{FAILED_SYNC_LABEL_CONTENT}</span>
        {detail.content === null ? (
          <span className="text-muted-foreground italic">
            {/* 'metadata-only' means the mutation never carried the body, so no
                text is at risk; 'missing' means text that WAS part of the change
                cannot be found any more. Distinct facts, distinct wording. */}
            {detail.contentSource === 'metadata-only' ? FAILED_SYNC_NO_CONTENT : FAILED_SYNC_CONTENT_UNKNOWN}
          </span>
        ) : (
          // Verbatim markdown, not rendered: this is a diagnostic view, and it
          // must stay selectable so the text can be rescued by hand when the
          // clipboard API is unavailable (HTTP on a LAN/NAS is not a secure
          // context). MarkdownPreview is a next/dynamic chunk that may not be
          // service-worker-cached, i.e. an endless spinner offline.
          <div className="max-h-48 overflow-y-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap wrap-break-word">
            {detail.content}
          </div>
        )}
      </div>

      <p className="text-muted-foreground">{FAILED_SYNC_KEEP_LOCAL_HINT}</p>
    </div>
  );
}
