import { AddonProviderType, AddonWarningType } from "wowup-lib-core";

/**
 * What main needs from the renderer's build config to run its providers. The Angular build picks the
 * environment file (dev/prod, wago/ow) and main's build can't see that choice yet, so the renderer
 * hands main the values once at startup.
 */
export interface AddonProviderConfig {
  wowUpHubUrl: string;
  wowUpWebsiteUrl: string;
  defaultHttpTimeoutMs: number;
  defaultHttpResetTimeoutMs: number;
  wowUpHubHttpTimeoutMs: number;
}

/** A main-side provider's fixed flags, for the renderer's stand-in */
export interface AddonProviderDescriptor {
  name: AddonProviderType;
  /** On unless the user turned it off, which the renderer still tracks (`AddonProviderFactory`) */
  enabled: boolean;
  forceIgnore: boolean;
  allowReinstall: boolean;
  allowChannelChange: boolean;
  allowEdit: boolean;
  allowViewAtSource: boolean;
  allowReScan: boolean;
  canShowChangelog: boolean;
  canBatchFetch: boolean;
  authRequired: boolean;
  adRequired: boolean;
  providerNote: string;
}

/** The provider methods the renderer may call on a main-side provider */
export const ADDON_PROVIDER_METHODS = [
  "getAllBatch",
  "getAll",
  "getFeaturedAddons",
  "searchByQuery",
  "searchByUrl",
  "searchProtocol",
  "getCategory",
  "getById",
  "scan",
  "getChangelog",
  "getDescription",
  "getDownloadAuth",
  "shouldMigrate",
  "getAddonIdsByFingerprints",
] as const;

export type AddonProviderMethod = (typeof ADDON_PROVIDER_METHODS)[number];

/**
 * One call on one provider. Arguments are the method's own, except that a URL travels as its string
 * (ipc can't clone a URL).
 */
export interface AddonProviderCallRequest {
  providerName: string;
  method: AddonProviderMethod;
  args: unknown[];
}

/**
 * An error as it crosses ipc. Electron keeps only the message of an error it clones, and callers
 * tell provider errors apart by class (`GenericProviderError`, `SourceRemovedAddonError`,
 * `HttpErrorResponse`) and by the breaker's `code`, so each is flattened here and rebuilt in the
 * renderer.
 */
export interface SerializedProviderError {
  kind: "error" | "provider" | "sourceRemoved" | "http";
  name: string;
  message: string;
  code?: string;
  status?: number;
  statusText?: string;
  url?: string;
  addonId?: string;
  warningType?: AddonWarningType;
  innerError?: SerializedProviderError;
}

export type AddonProviderCallResult = { ok: true; value: unknown } | { ok: false; error: SerializedProviderError };

/** Which main-side providers claim an addon url or a protocol link */
export interface AddonProviderMatchRequest {
  kind: "uri" | "protocol";
  value: string;
}
