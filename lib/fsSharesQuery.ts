import { isExpired, readRegistry } from './fsSharesRegistry';
import type { UserShareRecord } from './shareTypes';

export async function listSharesByUsername(username: string): Promise<UserShareRecord[]> {
  const now = Date.now();
  const registry = await readRegistry();
  const out: UserShareRecord[] = [];
  for (const [token, entry] of Object.entries(registry)) {
    if (entry.username !== username || isExpired(entry, now)) {
      continue;
    }

    out.push({
      token,
      noteId: entry.noteId,
      preset: entry.preset,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    });
  }

  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}
