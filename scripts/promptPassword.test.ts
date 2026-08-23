import { describe, expect, it } from 'bun:test';
import { EventEmitter } from 'events';
import { PasswordPromptAborted, readHidden, type KeyStream } from './promptPassword';

/** Feeds a byte sequence to readHidden and returns what it made of it. The real
 *  stdin is unusable here: without a TTY there is no raw mode, and a pty wrapper
 *  injects its own EOT before the payload ever arrives. */
function typed(...chunks: string[]): Promise<string> {
  const stream = new EventEmitter() as EventEmitter & KeyStream;
  const result = readHidden(stream);
  for (const chunk of chunks) {
    stream.emit('data', chunk);
  }

  return result;
}

// Written as code points for the same reason as in promptPassword.ts: a raw ESC
// or DEL in the source would be invisible in a diff and in review.
const ESC = String.fromCharCode(27);
const DEL = String.fromCharCode(127);
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BELL = String.fromCharCode(7);

describe('readHidden', () => {
  it('collects printable characters up to Enter', async () => {
    expect(await typed('geheim123\r')).toBe('geheim123');
  });

  it('accepts LF as well as CR, and ignores everything after it', async () => {
    expect(await typed('geheim123\nignoriert')).toBe('geheim123');
  });

  it('reassembles input split across chunks', async () => {
    expect(await typed('ge', 'heim', '123\r')).toBe('geheim123');
  });

  it('deletes the last character on DEL and on backspace', async () => {
    expect(await typed(`geheimX${DEL}123\r`)).toBe('geheim123');
    expect(await typed('geheimX\b123\r')).toBe('geheim123');
  });

  it('backspace on an empty buffer is a no-op, not an underflow', async () => {
    expect(await typed(`${DEL}${DEL}abc\r`)).toBe('abc');
  });

  it('drops a lone ESC without swallowing what follows', async () => {
    // Regression: a single ESC used to latch the escape state, silently eating
    // input up to the next letter — invisible, because nothing is echoed.
    expect(await typed(`ge${ESC}heim123\r`)).toBe('geheim123');
  });

  it('swallows a CSI sequence completely', async () => {
    expect(await typed(`ge${ESC}[Aheim123\r`)).toBe('geheim123');
  });

  it('swallows an SS3 sequence completely', async () => {
    expect(await typed(`ge${ESC}OPheim123\r`)).toBe('geheim123');
  });

  it('swallows a parameterised CSI sequence completely', async () => {
    expect(await typed(`ge${ESC}[3~heim123\r`)).toBe('geheim123');
  });

  it('handles an escape sequence split across chunks', async () => {
    expect(await typed('ge', ESC, '[A', 'heim123\r')).toBe('geheim123');
  });

  it('keeps a lone ESC from hiding the Enter that follows it', async () => {
    expect(await typed(`geheim123${ESC}\r`)).toBe('geheim123');
  });

  it('drops other control characters instead of storing them', async () => {
    expect(await typed(`geheim${BELL}123\r`)).toBe('geheim123');
  });

  it('keeps non-ASCII characters', async () => {
    expect(await typed('Größe-Straße\r')).toBe('Größe-Straße');
  });

  it('rejects on Ctrl-C', async () => {
    const outcome: unknown = await typed(`geheim${CTRL_C}`).catch((err: unknown) => err);
    expect(outcome).toBeInstanceOf(PasswordPromptAborted);
  });

  it('rejects on Ctrl-D', async () => {
    const outcome: unknown = await typed(`geheim${CTRL_D}`).catch((err: unknown) => err);
    expect(outcome).toBeInstanceOf(PasswordPromptAborted);
  });

  it('rejects when the stream ends mid-prompt instead of hanging', async () => {
    const stream = new EventEmitter() as EventEmitter & KeyStream;
    const result = readHidden(stream);
    stream.emit('data', 'halb');
    stream.emit('end');
    const outcome: unknown = await result.catch((err: unknown) => err);
    expect(outcome).toBeInstanceOf(PasswordPromptAborted);
  });

  it('stops listening once it has settled', async () => {
    const stream = new EventEmitter() as EventEmitter & KeyStream;
    const result = readHidden(stream);
    stream.emit('data', 'geheim123\r');
    stream.emit('data', 'danach\r');
    expect(await result).toBe('geheim123');
    expect(stream.listenerCount('data')).toBe(0);
    expect(stream.listenerCount('end')).toBe(0);
    expect(stream.listenerCount('close')).toBe(0);
  });
});
