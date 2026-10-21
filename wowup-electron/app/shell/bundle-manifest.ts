import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The bundle manifest format, shared by the shell (which verifies manifests) and scripts/*.mts (which
// build and sign them; Node runs this file directly, so it must stay plain, type-strippable TypeScript
// with no imports outside node built-ins). See "Manifest" in SHELL_BUNDLE_PLAN.md.

export interface UnsignedBundleManifest {
  flavor: string;
  channel: string;
  shellApi: number;
  version: string;
  /** Hex sha256 of the bundle .zip download */
  sha256: string;
  /** hashBundleDirectory() of the unpacked bundle, checked on every launch */
  contentSha256: string;
  urls: string[];
  rolloutPercent: number;
  revoked: string[];
  issuedAt: string;
}

export interface BundleManifest extends UnsignedBundleManifest {
  keyId: string;
  /** Base64 ed25519 signature over getSignedBytes() */
  signature: string;
}

/** Public keys the shell accepts manifests from, as SPKI PEM, by key id */
export type BundlePublicKeys = Record<string, string>;

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Hash of an unpacked bundle folder: every file's path (relative, "/"-separated) and content hash, sorted
 * by path. Bundles live on disk as folders rather than .asar files because Electron's embedded asar
 * integrity check, on in ow-electron and planned for the shell, refuses .asar files the exe doesn't list.
 */
export function hashBundleDirectory(dir: string): string {
  const hash = createHash("sha256");
  for (const relativePath of listFiles(dir).sort()) {
    hash.update(`${relativePath}\0${sha256Hex(readFileSync(join(dir, relativePath)))}\n`);
  }
  return hash.digest("hex");
}

function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(dir, relativePath) : [relativePath];
  });
}

/**
 * The bytes a signature covers: every field but the signature itself, including keyId so a signature
 * can't be replayed under another key, as JSON with keys sorted and no whitespace.
 */
export function getSignedBytes(manifest: UnsignedBundleManifest & { keyId: string; signature?: string }): Buffer {
  const signed: Record<string, unknown> = { ...manifest };
  delete signed.signature;
  return Buffer.from(canonicalJson(signed), "utf8");
}

export function signManifest(manifest: UnsignedBundleManifest, keyId: string, privateKeyPem: string): BundleManifest {
  const withKey = { ...manifest, keyId };
  const signature = sign(null, getSignedBytes(withKey), createPrivateKey(privateKeyPem));
  return { ...withKey, signature: signature.toString("base64") };
}

export function verifyManifest(manifest: BundleManifest, publicKeys: BundlePublicKeys): boolean {
  const publicKeyPem = publicKeys[manifest.keyId];
  if (publicKeyPem === undefined || typeof manifest.signature !== "string") {
    return false;
  }

  try {
    return verify(
      null,
      getSignedBytes(manifest),
      createPublicKey(publicKeyPem),
      Buffer.from(manifest.signature, "base64"),
    );
  } catch {
    return false;
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}
