// Runs the Publish bundle workflow's steps locally, with local stand-ins for GitHub, so the publish flow can
// be tried without touching WowUp/wowup-bundles. See "Storage & delivery" in SHELL_BUNDLE_PLAN.md.
//
// Under app-build/local-publish/ (all git-ignored):
//  - releases/<flavor>-<version>/<flavor>-<version>-<sha256>.zip  stands in for the GitHub release
//  - pages/                                                         stands in for the wowup-bundles checkout
//  - local-test-key.pem                                             a throwaway signing key, made on first run
// It then serves releases/ and pages/ over http://localhost and checks the result as a client would: manifest
// signature, zip hash, folder hash after unzipping. Only shells packaged from a locally signed bundle trust the
// local key (see scripts/lib/local-key.mts); release builds never do.
//
// Uses the bundle the last `build:prod` / `ow:build:prod` packaged (app-build/packed/).
//
//   npm run bundle:publish:local -- [--channel beta|stable] [--rollout 0-100] [--revoke <version>]...
//     [--port 8787] [--serve] [--reset]
//
//  --serve  keep serving after the checks, e.g. for a dev build to download from
//  --reset  forget earlier local publishes (keeps the key), e.g. after rebuilding the same version
import AdmZip from "adm-zip";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  type BundleManifest,
  hashBundleDirectory,
  sha256Hex,
  type UnsignedBundleManifest,
  verifyManifest,
} from "../../wowup-shell/contract/bundle-manifest.ts";
import { channelManifestPath } from "./lib/channel-manifest.mts";
import { getLocalKey, LOCAL_KEY_ID } from "./lib/local-key.mts";
import { describePublish, publishToPages, readJson, splitList } from "./lib/pages.mts";
import { getPublicKeyPem, signWithKey } from "./lib/signing.mts";

const CONTENT_TYPES: Record<string, string> = { ".json": "application/json", ".zip": "application/zip" };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packedDir = join(root, "app-build", "packed");
const outDir = join(root, "app-build", "local-publish");

const { values } = parseArgs({
  options: {
    channel: { type: "string", default: "beta" },
    rollout: { type: "string", default: "100" },
    revoke: { type: "string", multiple: true, default: [] },
    port: { type: "string", default: "8787" },
    serve: { type: "boolean", default: false },
    reset: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Serves releases/ and pages/ only, never the key */
function serve(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const path = resolve(outDir, `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`);
    const allowed = [join(outDir, "releases") + sep, join(outDir, "pages") + sep].some((dir) => path.startsWith(dir));
    if (!allowed || !existsSync(path) || !statSync(path).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  });
  return new Promise((ok, reject) => server.once("error", reject).listen(port, "127.0.0.1", () => ok(server)));
}

/** What a client does with a published manifest */
async function check(manifestUrl: string, publicKeys: Record<string, string>): Promise<boolean> {
  const manifest = (await (await fetch(manifestUrl)).json()) as BundleManifest;
  const signed = verifyManifest(manifest, publicKeys);
  const tampered = verifyManifest({ ...manifest, rolloutPercent: (manifest.rolloutPercent + 1) % 101 }, publicKeys);

  const zip = Buffer.from(await (await fetch(manifest.urls[0])).arrayBuffer());
  const zipMatches = sha256Hex(zip) === manifest.sha256;

  const unzipped = mkdtempSync(join(tmpdir(), "wowup-local-publish-"));
  try {
    new AdmZip(zip).extractAllTo(unzipped, true);
    const contentMatches = hashBundleDirectory(unzipped) === manifest.contentSha256;

    console.log(`  signature verifies:      ${signed}`);
    console.log(`  tampered copy rejected:  ${!tampered}`);
    console.log(`  zip matches sha256:      ${zipMatches}`);
    console.log(`  folder matches content:  ${contentMatches}`);
    return signed && !tampered && zipMatches && contentMatches;
  } finally {
    rmSync(unzipped, { recursive: true, force: true });
  }
}

if (values.reset) {
  rmSync(join(outDir, "releases"), { recursive: true, force: true });
  rmSync(join(outDir, "pages"), { recursive: true, force: true });
}

const base = readJson<UnsignedBundleManifest>(join(packedDir, "bundle-manifest.json"));
const zipPath = join(packedDir, "bundle.zip");
if (base === undefined || !existsSync(zipPath)) {
  fail("No packaged bundle in app-build/packed/; run `npm run build:prod` (or `ow:build:prod`) first");
}
if (sha256Hex(readFileSync(zipPath)) !== base.sha256) {
  fail("app-build/packed/bundle.zip doesn't match its manifest; rebuild the bundle");
}

const privateKeyPem = getLocalKey();
const publicKeys = { [LOCAL_KEY_ID]: getPublicKeyPem(privateKeyPem) };

// The "release": published once per version, like the workflow
const tag = `${base.flavor}-${base.version}`;
const asset = `${tag}-${base.sha256}.zip`;
const releaseDir = join(outDir, "releases", tag);
if (existsSync(releaseDir) && !existsSync(join(releaseDir, asset))) {
  fail(`${tag} was already published locally with different content; bump the version or pass --reset`);
}
mkdirSync(releaseDir, { recursive: true });
copyFileSync(zipPath, join(releaseDir, asset));

const port = Number(values.port);
const server = await serve(port).catch((e: Error) => fail(`Couldn't serve on port ${port}: ${e.message}`));
const baseUrl = `http://localhost:${port}`;

try {
  const result = publishToPages(
    join(outDir, "pages"),
    base,
    {
      channel: values.channel,
      rolloutPercent: Number(values.rollout),
      revoke: splitList(values.revoke),
      urls: [`${baseUrl}/releases/${tag}/${asset}`],
      now: new Date(),
    },
    (manifest) => signWithKey(manifest, LOCAL_KEY_ID, privateKeyPem),
  );
  console.log(describePublish(result));
} catch (e) {
  server.close();
  fail((e as Error).message);
}

const manifestUrl = `${baseUrl}/pages/${channelManifestPath(base.flavor, values.channel, base.shellApi)}`;
console.log(`Checking ${manifestUrl} as a client would:`);
const ok = await check(manifestUrl, publicKeys);

if (values.serve) {
  console.log(
    `\nServing ${baseUrl}/pages/ and ${baseUrl}/releases/ (signed with key "${LOCAL_KEY_ID}"); Ctrl+C to stop`,
  );
  console.log(`Public key for "${LOCAL_KEY_ID}":\n${publicKeys[LOCAL_KEY_ID]}`);
} else {
  server.close();
  process.exitCode = ok ? 0 : 1;
}
