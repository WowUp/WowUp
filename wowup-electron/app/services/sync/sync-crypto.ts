import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from "crypto";
import { gunzipSync, gzipSync } from "zlib";

import {
  SETTINGS_SYNC_ERROR_INVALID_CODE,
  SETTINGS_SYNC_ERROR_WRONG_KEY,
} from "../../../src/common/models/settings-sync";

/**
 * Everything that leaves the device is encrypted with a key only the user's devices know: the sync
 * code. Storage (a shared folder today, a relay later) sees random names and ciphertext only.
 *
 * Code format: "WUS1-" + 52 base32 chars of a 256-bit secret + 4 base32 chars of checksum, in
 * groups of four. The checksum catches typos, which would otherwise silently open a new, empty vault.
 */

const CODE_PREFIX = "WUS1";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1: they get misread when typed over
const SECRET_BYTES = 32;
const SECRET_CHARS = 52; // ceil(256 / 5)
const CHECK_CHARS = 4;

const MAGIC = Buffer.from("WUS1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface SyncKeys {
  /** Public name of the vault, safe to use as a folder or URL segment */
  vaultId: string;
  encryptionKey: Buffer;
  /** Keys the names of stored objects, so storage can't tell which files they are */
  nameKey: Buffer;
}

function toBase32(bytes: Buffer, length: number): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31];
  }
  return out.slice(0, length);
}

function fromBase32(chars: string, byteLength: number): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of chars) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error(SETTINGS_SYNC_ERROR_INVALID_CODE);
    }
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out.slice(0, byteLength));
}

function checksum(secretChars: string): string {
  return toBase32(createHash("sha256").update(`${CODE_PREFIX}:${secretChars}`).digest(), CHECK_CHARS);
}

function group(chars: string): string {
  return chars.match(/.{1,4}/g)?.join("-") ?? chars;
}

export function createSyncCode(): string {
  const secretChars = toBase32(randomBytes(SECRET_BYTES), SECRET_CHARS);
  return `${CODE_PREFIX}-${group(secretChars + checksum(secretChars))}`;
}

/** Upper-cases, drops spaces and dashes and checks the checksum; throws SETTINGS_SYNC_ERROR_INVALID_CODE */
export function normalizeSyncCode(input: string): string {
  const compact = (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith(CODE_PREFIX)) {
    throw new Error(SETTINGS_SYNC_ERROR_INVALID_CODE);
  }
  const body = compact.slice(CODE_PREFIX.length);
  if (body.length !== SECRET_CHARS + CHECK_CHARS) {
    throw new Error(SETTINGS_SYNC_ERROR_INVALID_CODE);
  }
  const secretChars = body.slice(0, SECRET_CHARS);
  if (checksum(secretChars) !== body.slice(SECRET_CHARS) || /[^A-HJ-NP-Z2-9]/.test(secretChars)) {
    throw new Error(SETTINGS_SYNC_ERROR_INVALID_CODE);
  }
  return `${CODE_PREFIX}-${group(body)}`;
}

/** The first group after the prefix: enough to tell codes apart in the UI */
export function getCodeHint(code: string): string {
  return normalizeSyncCode(code).split("-").slice(0, 2).join("-");
}

export function deriveSyncKeys(code: string): SyncKeys {
  const body = normalizeSyncCode(code).replace(/-/g, "").slice(CODE_PREFIX.length);
  const secret = fromBase32(body.slice(0, SECRET_CHARS), SECRET_BYTES);
  const salt = Buffer.from("wowup-settings-sync-v1");
  const derive = (info: string, length: number) => Buffer.from(hkdfSync("sha256", secret, salt, info, length));

  return {
    vaultId: derive("vault-id", 16).toString("hex"),
    encryptionKey: derive("encryption-key", 32),
    nameKey: derive("name-key", 32),
  };
}

/** A stable, opaque storage name for a logical name (a game flavor, a file's content hash) */
export function opaqueName(keys: SyncKeys, logicalName: string): string {
  return createHmac("sha256", keys.nameKey).update(logicalName).digest("hex").slice(0, 40);
}

/**
 * gzip + AES-256-GCM. `context` is bound as associated data, so a blob moved to another name (or
 * a manifest swapped between games) fails to decrypt instead of being accepted.
 */
export function seal(keys: SyncKeys, plaintext: Buffer, context: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys.encryptionKey, iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

/** Throws SETTINGS_SYNC_ERROR_WRONG_KEY when the data was not sealed with these keys and context */
export function open(keys: SyncKeys, sealed: Buffer, context: string): Buffer {
  if (sealed.length < MAGIC.length + IV_BYTES + TAG_BYTES || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error(SETTINGS_SYNC_ERROR_WRONG_KEY);
  }
  const iv = sealed.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = sealed.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const body = sealed.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", keys.encryptionKey, iv);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(tag);
    return gunzipSync(Buffer.concat([decipher.update(body), decipher.final()]));
  } catch {
    throw new Error(SETTINGS_SYNC_ERROR_WRONG_KEY);
  }
}
