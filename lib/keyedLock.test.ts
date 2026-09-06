import { describe, expect, test } from 'bun:test';
import { createKeyedLock } from './keyedLock';

/** A promise plus its resolve/reject, so a test can hold `fn` open. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createKeyedLock', () => {
  test('serializes calls on the same key', async () => {
    const withLock = createKeyedLock();
    const order: string[] = [];
    const first = deferred();

    const a = withLock('note-1', async () => {
      order.push('a:start');
      await first.promise;
      order.push('a:end');
    });
    const b = withLock('note-1', () => {
      order.push('b:start');
      return Promise.resolve();
    });

    // b must not have started while a is still pending.
    await Promise.resolve();
    expect(order).toEqual(['a:start']);

    first.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(['a:start', 'a:end', 'b:start']);
  });

  test('different keys run concurrently', async () => {
    const withLock = createKeyedLock();
    const order: string[] = [];
    const first = deferred();

    const a = withLock('note-1', async () => {
      order.push('a:start');
      await first.promise;
      order.push('a:end');
    });
    const b = withLock('note-2', () => {
      order.push('b:start');
      return Promise.resolve();
    });

    await b;
    // b finished while a is still holding its own key.
    expect(order).toEqual(['a:start', 'b:start']);

    first.resolve();
    await a;
    expect(order).toEqual(['a:start', 'b:start', 'a:end']);
  });

  test('the chain survives a rejected fn', async () => {
    const withLock = createKeyedLock();

    const failing = withLock('note-1', () => Promise.reject(new Error('boom')));
    const following = withLock('note-1', () => Promise.resolve('ok'));

    const settled = await Promise.allSettled([failing, following]);
    expect(settled[0].status).toBe('rejected');
    expect(settled[1]).toEqual({ status: 'fulfilled', value: 'ok' });
  });

  test('an idle key is released and still usable afterwards', async () => {
    const withLock = createKeyedLock();

    expect(await withLock('note-1', () => Promise.resolve(1))).toBe(1);
    expect(await withLock('note-1', () => Promise.resolve(2))).toBe(2);
  });

  test('the constant key used by withSharesLock behaves like any other', async () => {
    const withLock = createKeyedLock();
    const order: string[] = [];
    const first = deferred();

    const a = withLock('', async () => {
      order.push('a:start');
      await first.promise;
      order.push('a:end');
    });
    const b = withLock('', () => {
      order.push('b:start');
      return Promise.resolve();
    });

    await Promise.resolve();
    expect(order).toEqual(['a:start']);

    first.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(['a:start', 'a:end', 'b:start']);
  });
});
