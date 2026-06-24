// Escapes regex metacharacters so a dynamic string can be embedded safely
// in a RegExp source. Shared by lib/shareContent.ts and lib/attachmentUpload.ts.
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
