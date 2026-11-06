// Writes a channel's manifest into a wowup-bundles Pages folder: the real repo's checkout in CI
// (scripts/publish-manifest.mts), or a local stand-in (scripts/publish-local.mts). See "Storage & delivery" in
// SHELL_BUNDLE_PLAN.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { BundleManifest, UnsignedBundleManifest } from "../../../wowup-shell/contract/bundle-manifest.ts";
import {
  buildChannelManifest,
  channelManifestPath,
  type ChannelOptions,
  versionRecordPath,
} from "./channel-manifest.mts";

export interface PublishResult {
  manifest: BundleManifest;
  /** The channel's manifest before this publish, if it had one */
  previous: BundleManifest | undefined;
}

export function readJson<T>(file: string): T | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : undefined;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Publishes base to a channel: writes the channel's signed manifest, plus the version record that lets the
 * version be promoted later. A version is published once, so a record with different content is refused.
 */
export function publishToPages(
  pagesDir: string,
  base: UnsignedBundleManifest,
  options: ChannelOptions,
  sign: (manifest: UnsignedBundleManifest) => BundleManifest,
): PublishResult {
  const channelFile = join(pagesDir, channelManifestPath(base.flavor, options.channel, base.shellApi));
  const previous = readJson<BundleManifest>(channelFile);
  const unsignedManifest = buildChannelManifest(base, previous, options);

  const recordFile = join(pagesDir, versionRecordPath(base.flavor, base.version));
  const record = readJson<UnsignedBundleManifest>(recordFile);
  if (record !== undefined && record.sha256 !== base.sha256) {
    throw new Error(`${base.flavor} ${base.version} was already published with different content`);
  }

  // Sign before writing anything, so a signing failure leaves the folder untouched
  const manifest = sign(unsignedManifest);
  if (record === undefined) {
    const { keyId: _keyId, signature: _signature, ...unsigned } = base as Partial<BundleManifest>;
    writeJson(recordFile, { ...unsigned, urls: manifest.urls });
  }
  writeJson(channelFile, manifest);

  return { manifest, previous };
}

/** Workflow inputs arrive as comma-separated lists */
export function splitList(values: string[]): string[] {
  return values
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

export function describePublish({ manifest, previous }: PublishResult): string {
  const was = previous ? ` (was ${previous.version})` : "";
  return (
    `Published ${manifest.flavor} ${manifest.version} to ${manifest.channel}${was}, ` +
    `rollout ${manifest.rolloutPercent}%, revoked [${manifest.revoked.join(", ")}]`
  );
}
