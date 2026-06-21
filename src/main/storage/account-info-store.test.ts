import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deriveKey,
  encryptJson,
  decryptJson,
  createAccountInfoStore,
  mergeAccountInfo,
} from './account-info-store';

describe('deriveKey', () => {
  it('is deterministic for the same seed', () => {
    expect(deriveKey('seed-a').equals(deriveKey('seed-a'))).toBe(true);
  });

  it('produces a different key for a different seed', () => {
    expect(deriveKey('seed-a').equals(deriveKey('seed-b'))).toBe(false);
  });

  it('produces a 32-byte key (AES-256)', () => {
    expect(deriveKey('seed-a').length).toBe(32);
  });
});

describe('encryptJson / decryptJson', () => {
  const key = deriveKey('round-trip-seed');

  it('round-trips an object', () => {
    const value = { googlePassword: 'pw', totpSecret: 'ABCD', recoveryEmail: 'r@x.com' };
    expect(decryptJson(encryptJson(value, key), key)).toEqual(value);
  });

  it('does not leak the plaintext into the ciphertext', () => {
    const blob = encryptJson({ totpSecret: 'SUPERSECRET' }, key);
    expect(blob.toString('utf-8')).not.toContain('SUPERSECRET');
  });

  it('throws when decrypting with the wrong key', () => {
    const blob = encryptJson({ googlePassword: 'pw' }, key);
    expect(() => decryptJson(blob, deriveKey('other-seed'))).toThrow();
  });

  it('throws when the ciphertext is tampered with', () => {
    const blob = encryptJson({ googlePassword: 'pw' }, key);
    blob[blob.length - 1] ^= 0xff;
    expect(() => decryptJson(blob, key)).toThrow();
  });
});

describe('mergeAccountInfo', () => {
  it('overrides an existing field with the incoming value', () => {
    expect(mergeAccountInfo({ googlePassword: 'old' }, { googlePassword: 'new' })).toEqual({
      googlePassword: 'new',
    });
  });

  it('leaves an existing field untouched when the incoming field is undefined', () => {
    expect(mergeAccountInfo({ googlePassword: 'keep', totpSecret: 'K' }, { recoveryEmail: 'r@x.com' })).toEqual(
      { googlePassword: 'keep', totpSecret: 'K', recoveryEmail: 'r@x.com' },
    );
  });

  it('clears a field when the incoming value is an empty string', () => {
    expect(mergeAccountInfo({ googlePassword: 'old' }, { googlePassword: '' })).toEqual({});
  });

  it('builds from empty existing info', () => {
    expect(mergeAccountInfo({}, { totpSecret: 'K' })).toEqual({ totpSecret: 'K' });
  });

  it('merges the payment fields (cardLast4 / cardExpiry / billingAddress / note)', () => {
    expect(
      mergeAccountInfo(
        { googlePassword: 'keep' },
        {
          cardLast4: '4242',
          cardExpiry: '09/27',
          billingAddress: '123 Main St\nCity',
          note: 'hello',
        },
      ),
    ).toEqual({
      googlePassword: 'keep',
      cardLast4: '4242',
      cardExpiry: '09/27',
      billingAddress: '123 Main St\nCity',
      note: 'hello',
    });
  });

  it('leaves existing payment fields untouched when not in the incoming patch', () => {
    expect(mergeAccountInfo({ cardLast4: '4242' }, { note: 'n' })).toEqual({
      cardLast4: '4242',
      note: 'n',
    });
  });

  it('clears a payment field when the incoming value is an empty string', () => {
    expect(mergeAccountInfo({ cardLast4: '4242' }, { cardLast4: '' })).toEqual({});
  });
});

describe('createAccountInfoStore', () => {
  let dir: string;
  let filePath: string;
  const key = deriveKey('store-seed');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ainfo-'));
    filePath = join(dir, 'account-info.enc');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for an unknown email', () => {
    const store = createAccountInfoStore(filePath, key);
    expect(store.get('nobody@x.com')).toBeNull();
  });

  it('stores and reads back account info', () => {
    const store = createAccountInfoStore(filePath, key);
    store.set('a@x.com', { googlePassword: 'pw', totpSecret: 'KEY' });
    expect(store.get('a@x.com')).toEqual({ googlePassword: 'pw', totpSecret: 'KEY' });
  });

  it('persists across store instances (data written to disk)', () => {
    createAccountInfoStore(filePath, key).set('a@x.com', { link: 'https://x.com' });
    const reopened = createAccountInfoStore(filePath, key);
    expect(reopened.get('a@x.com')).toEqual({ link: 'https://x.com' });
  });

  it('keeps multiple accounts independent', () => {
    const store = createAccountInfoStore(filePath, key);
    store.set('a@x.com', { googlePassword: 'a' });
    store.set('b@x.com', { googlePassword: 'b' });
    expect(store.get('a@x.com')).toEqual({ googlePassword: 'a' });
    expect(store.get('b@x.com')).toEqual({ googlePassword: 'b' });
  });

  it('deletes an entry', () => {
    const store = createAccountInfoStore(filePath, key);
    store.set('a@x.com', { googlePassword: 'pw' });
    store.delete('a@x.com');
    expect(store.get('a@x.com')).toBeNull();
  });

  it('never writes the secret to disk in plaintext', () => {
    const store = createAccountInfoStore(filePath, key);
    store.set('a@x.com', { totpSecret: 'PLAINTEXTSECRET' });
    expect(readFileSync(filePath).toString('utf-8')).not.toContain('PLAINTEXTSECRET');
  });

  it('treats a corrupt file as empty instead of throwing', () => {
    writeFileSync(filePath, Buffer.from('not a valid encrypted blob'));
    const store = createAccountInfoStore(filePath, key);
    expect(store.get('a@x.com')).toBeNull();
  });
});
