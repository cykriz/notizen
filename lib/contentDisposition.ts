/**
 * The Content-Disposition header value for an attachment download.
 *
 * Per RFC 6266: legacy `filename=` carries display chars in a quoted string
 * (sanitize \ and " for safety); modern `filename*` (RFC 5987) is
 * percent-encoded UTF-8 and wins on browsers that support it.
 */
export function contentDisposition(fileName: string, { inline }: { inline: boolean }): string {
  const safeFilename = fileName.replace(/[\\"]/g, '_');
  const encoded = encodeURIComponent(fileName);
  return `${inline ? 'inline' : 'attachment'}; filename="${safeFilename}"; filename*=UTF-8''${encoded}`;
}
