// Publishes a bundle to a channel by writing its signed manifest into a checkout of the wowup-bundles
// Pages repo, see "Storage & delivery" in SHELL_BUNDLE_PLAN.md. Used by the Publish bundle workflow (with
// the manifest scripts/build-bundle.mts wrote) and the Promote bundle workflow (with a version record).
// Signs with BUNDLE_SIGNING_KEY / BUNDLE_SIGNING_KEY_ID. Committing and pushing is left to the caller.
//
//   node scripts/publish-manifest.mts --pages-dir <dir> --base <manifest> --channel <beta|stable>
//     [--rollout <0-100>] [--url <download url>]... [--revoke <version>]...
import { parseArgs } from "node:util";

import type { UnsignedBundleManifest } from "../../wowup-shell/contract/bundle-manifest.ts";
import { describePublish, publishToPages, readJson, splitList } from "./lib/pages.mts";
import { signWithEnvKey } from "./lib/signing.mts";

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

  const result = publishToPages(
    pagesDir,
    base,
    {
      channel,
      rolloutPercent: Number(values.rollout),
      revoke: splitList(values.revoke),
      urls: values.url,
      now: new Date(),
    },
    signWithEnvKey,
  );
  console.log(describePublish(result));
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
