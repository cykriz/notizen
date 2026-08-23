/**
 * Password entry for the user-management CLI.
 *
 * `readline` echoes everything it reads, so the old prompt wrote the password
 * into the terminal scrollback — the exact leak the "prompt instead of argv"
 * path exists to avoid (argv lands in the shell history). Raw mode without an
 * echo fixes it: nothing is written back while typing.
 *
 * Keys are compared as code points, not as escape literals: a raw DEL or ESC in
 * the source would be invisible in a diff and in review.
 */
const KEY_ENTER = [13, 10]; // CR, LF
const KEY_BACKSPACE = [127, 8]; // DEL, BS
const KEY_ABORT = [3, 4]; // Ctrl-C, Ctrl-D
const KEY_ESCAPE = 27;
const FIRST_PRINTABLE = 32; // space — everything below is a control character
// An arrow key arrives as ESC '[' 'A'. Its trailing bytes must not land in the
// password, so they are swallowed — but only for a *real* sequence: ESC followed
// by '[' (CSI) or 'O' (SS3). A lone ESC stands for itself, hence three states.
const CSI_INTRO = ['[', 'O'];
const CSI_END_RE = /[A-Za-z~]/; // a CSI sequence ends on a letter or '~'
const ESC_STATE = { NONE: 'none', AFTER_ESC: 'afterEsc', IN_CSI: 'inCsi' } as const;
type EscState = (typeof ESC_STATE)[keyof typeof ESC_STATE];

/** The one place that decides whether a human is at the other end. Both the
 *  echo suppression here and the confirmation prompt in the CLI hang off it, so
 *  they cannot drift apart. */
export function isInteractive(): boolean {
  return process.stdin.isTTY;
}

export class PasswordPromptAborted extends Error {
  constructor() {
    super('Abgebrochen.');
    this.name = 'PasswordPromptAborted';
  }
}

/**
 * Piped or redirected stdin: nothing reaches a terminal, so there is nothing to
 * hide — and raw mode is not available on a pipe.
 *
 * Read the stream directly rather than through `readline`: readline never hands
 * over a final line that has no trailing newline (`printf 'pw' | …`), so a fully
 * supplied password was silently discarded as an abort. An empty read means no
 * input at all (`< /dev/null`) and stays an abort.
 */
async function readPiped(): Promise<string> {
  const raw = await Bun.stdin.text();
  const [firstLine = ''] = raw.split('\n');
  const password = firstLine.replace(/\r$/, '');

  if (password === '') {
    throw new PasswordPromptAborted();
  }

  return password;
}

/** Just the two methods `readHidden` needs. Narrower than `process.stdin` so the
 *  key handling can be tested without a TTY — a pty wrapper injects its own EOT
 *  and echoes, so it tests the wrapper rather than this code. */
export interface KeyStream {
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
  on(event: 'end' | 'close', listener: () => void): unknown;
  off(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
  off(event: 'end' | 'close', listener: () => void): unknown;
}

export function readHidden(stdin: KeyStream): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let value = '';
    let escState: EscState = ESC_STATE.NONE;

    function detach(): void {
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.off('close', onEnd);
    }

    // The stream dying mid-prompt (terminal detached) must settle the promise,
    // exactly as the pipe path does on EOF — otherwise the CLI hangs forever.
    function onEnd(): void {
      detach();
      reject(new PasswordPromptAborted());
    }

    const onData = (chunk: Buffer | string): void => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

      for (const char of text) {
        if (escState === ESC_STATE.IN_CSI) {
          if (CSI_END_RE.test(char)) {
            escState = ESC_STATE.NONE;
          }

          continue;
        }

        if (escState === ESC_STATE.AFTER_ESC) {
          escState = ESC_STATE.NONE;
          if (CSI_INTRO.includes(char)) {
            escState = ESC_STATE.IN_CSI;
            continue;
          }
          // Lone ESC: it stood for itself, so this character is real input and
          // falls through to the normal handling below.
        }

        const code = char.codePointAt(0) ?? 0;

        if (KEY_ENTER.includes(code)) {
          detach();
          resolve(value);
          return;
        }

        if (KEY_ABORT.includes(code)) {
          detach();
          reject(new PasswordPromptAborted());
          return;
        }

        if (KEY_BACKSPACE.includes(code)) {
          value = value.slice(0, -1);
        } else if (code === KEY_ESCAPE) {
          escState = ESC_STATE.AFTER_ESC;
        } else if (code >= FIRST_PRINTABLE) {
          value += char;
        }
      }
    };

    stdin.on('data', onData);
    stdin.on('end', onEnd);
    stdin.on('close', onEnd);
  });
}

/** Reads a password without echoing it. Rejects with `PasswordPromptAborted`
 *  on Ctrl-C / Ctrl-D. */
export async function promptPassword(prompt: string): Promise<string> {
  const stdin = process.stdin;

  // Nobody is reading a prompt on the other end of a pipe, and writing it would
  // only pollute the stdout of whatever script is driving the CLI.
  if (!isInteractive()) {
    return await readPiped();
  }

  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  try {
    return await readHidden(stdin);
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
    process.stdout.write('\n');
  }
}
