// Publishes a bundle to a channel by writing its signed manifest into a checkout of the wowup-bundles
// Pages repo, see "Storage & delivery" in SHELL_BUNDLE_PLAN.md. Used by the Publish bundle workflow (with
// the manifest scripts/build-bundle.mts wrote) and the Promote bundle workflow (with a version record).
// Signs with BUNDLE_SIGNING_KEY / BUNDLE_SIGNING_KEY_ID. Committing and pushing is left to the caller.
//
//   node scripts/publish-manifest.mts --pages-dir <dir> --base <manifest> --channel <beta|stable>
//     [--rollout <0-100>] [--url <download url>]... [--revoke <version>]...
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import type { BundleManifest, UnsignedBundleManifest } from "../app/shell/bundle-manifest.ts";
import { buildChannelManifest, channelManifestPath, versionRecordPath } from "./lib/channel-manifest.mts";
import { signWithEnvKey } from "./lib/signing.mts";

function readJson<T>(file: string): T | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : undefined;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const { values } = parseArgs({
    options: {
      "pages-dir": { type: "string" },
      base: { type: "string" },
      channel: { type: "string" },
      rollout: { type: "string", default: "100" },
      url: { type: "string", multiple: true, default: [] },
      revoke: { type: "string", multiple: true, default: [] },
    },
  });

  const pagesDir = values["pages-dir"];
  const baseFile = values.base;
  const channel = values.channel;
  if (!pagesDir || !baseFile || !channel) {
    throw new Error("--pages-dir, --base and --channel are required");
  }

  const base = readJson<UnsignedBundleManifest>(baseFile);
  if (base === undefined) {
    throw new Error(`${baseFile} doesn't exist`);
  }

  const channelFile = join(pagesDir, channelManifestPath(base.flavor, channel, base.shellApi));
  const current = readJson<BundleManifest>(channelFile);

  const manifest = buildChannelManifest(base, current, {
    channel,
    rolloutPercent: Number(values.rollout),
    // Accept comma-separated lists too, which is how workflow inputs arrive
    revoke: values.revoke
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean),
    urls: values.url,
    now: new Date(),
  });

  // The record of what this version is, kept so it can be promoted later. A version is published once.
  const recordFile = join(pagesDir, versionRecordPath(base.flavor, base.version));
  const record = readJson<UnsignedBundleManifest>(recordFile);
  if (record !== undefined && record.sha256 !== base.sha256) {
    throw new Error(`${base.flavor} ${base.version} was already published with different content`);
  }
  if (record === undefined) {
    const { keyId: _keyId, signature: _signature, ...unsigned } = base as Partial<BundleManifest>;
    writeJson(recordFile, { ...unsigned, urls: manifest.urls });
  }

  writeJson(channelFile, signWithEnvKey(manifest));

  const previous = current ? ` (was ${current.version})` : "";
  console.log(
    `Published ${base.flavor} ${base.version} to ${channel}${previous}, rollout ${manifest.rolloutPercent}%, ` +
      `revoked [${manifest.revoked.join(", ")}]`,
  );
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
