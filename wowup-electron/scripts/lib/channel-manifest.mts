// Builds the manifest a channel publishes, see "Storage & delivery" in SHELL_BUNDLE_PLAN.md. Pure, so the
// publish rules are testable: scripts/publish-manifest.mts does the file handling and signing.
import { type BundleManifest, compareVersions, type UnsignedBundleManifest } from "../../app/shell/bundle-manifest.ts";

export interface ChannelOptions {
  channel: string;
  rolloutPercent: number;
  /** Versions to add to the channel's revoked list, on top of the ones already there */
  revoke: string[];
  /** Download URLs; the base manifest's are kept when empty */
  urls: string[];
  now: Date;
}

/** Where a channel's manifest lives in the wowup-bundles Pages repo */
export function channelManifestPath(flavor: string, channel: string, shellApi: number): string {
  return `${flavor}/${channel}/shell-api-${shellApi}.json`;
}

/** Where the record of a published bundle lives, used to promote it later without rebuilding */
export function versionRecordPath(flavor: string, version: string): string {
  return `${flavor}/versions/${version}.json`;
}

/**
 * The next manifest for a channel: base's bundle, with the channel's settings. Carries the current
 * manifest's revoked list forward, refuses to go back to an older version unless the current one is
 * revoked (clients refuse that too), and always issues later than the current manifest, since clients
 * reject a manifest older than the last one they accepted.
 */
export function buildChannelManifest(
  base: UnsignedBundleManifest,
  current: BundleManifest | undefined,
  options: ChannelOptions,
): UnsignedBundleManifest {
  if (!/^[a-z]+$/.test(options.channel)) {
    throw new Error(`Invalid channel "${options.channel}"`);
  }
  if (!Number.isInteger(options.rolloutPercent) || options.rolloutPercent < 0 || options.rolloutPercent > 100) {
    throw new Error(`rolloutPercent must be a whole number from 0 to 100, got ${options.rolloutPercent}`);
  }

  const urls = options.urls.length > 0 ? options.urls : base.urls;
  if (urls.length === 0) {
    throw new Error(`No download URLs for ${base.flavor} ${base.version}`);
  }

  if (current !== undefined && (current.flavor !== base.flavor || current.shellApi !== base.shellApi)) {
    throw new Error(
      `The ${options.channel} manifest is for ${current.flavor} shell API ${current.shellApi}, ` +
        `not ${base.flavor} shell API ${base.shellApi}`,
    );
  }

  const revoked = [...new Set([...(current?.revoked ?? []), ...options.revoke])].sort(compareVersions);
  if (revoked.includes(base.version)) {
    throw new Error(`${base.version} is revoked and can't be published`);
  }

  if (
    current !== undefined &&
    compareVersions(base.version, current.version) < 0 &&
    !revoked.includes(current.version)
  ) {
    throw new Error(
      `${base.version} is older than the ${options.channel} channel's current ${current.version}; ` +
        `clients only go back if ${current.version} is revoked`,
    );
  }

  let issuedAt = options.now;
  if (current !== undefined && issuedAt.getTime() <= Date.parse(current.issuedAt)) {
    issuedAt = new Date(Date.parse(current.issuedAt) + 1);
  }

  return {
    flavor: base.flavor,
    channel: options.channel,
    shellApi: base.shellApi,
    version: base.version,
    sha256: base.sha256,
    contentSha256: base.contentSha256,
    urls,
    rolloutPercent: options.rolloutPercent,
    revoked,
    issuedAt: issuedAt.toISOString(),
  };
}
