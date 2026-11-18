import { GenericProviderError, SourceRemovedAddonError } from "wowup-lib-core";

import {
  AssetMissingError,
  ErrorContainer,
  GitHubFetchReleasesError,
  GitHubFetchRepositoryError,
  GitHubLimitError,
  NoReleaseFoundError,
  TocNotFoundError,
} from "../../../src/common/errors";
import { SerializedProviderError } from "../../../src/common/models/addon-provider";
import { HttpError } from "../network/http-client";

/** Flattens an error for ipc, keeping what callers branch on. The renderer rebuilds it (`reviveProviderError`). */
export function serializeProviderError(error: unknown): SerializedProviderError {
  if (!(error instanceof Error)) {
    return { kind: "error", name: "Error", message: String(error) };
  }

  const serialized: SerializedProviderError = {
    kind: "error",
    name: error.name,
    message: error.message,
  };

  // opossum's EOPENBREAKER / ETIMEDOUT, node's network codes
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") {
    serialized.code = code;
  }

  if (error instanceof HttpError) {
    serialized.kind = "http";
    serialized.status = error.status;
    serialized.statusText = error.statusText;
    serialized.url = error.url;
  } else if (error instanceof SourceRemovedAddonError) {
    serialized.kind = "sourceRemoved";
    serialized.addonId = error.addonId;
  } else if (error instanceof GenericProviderError) {
    serialized.kind = "provider";
  } else if (error instanceof GitHubLimitError) {
    serialized.kind = "githubLimit";
    serialized.rateLimit = {
      max: error.rateLimitMax,
      used: error.rateLimitUsed,
      remaining: error.rateLimitRemaining,
      reset: error.rateLimitReset,
    };
  } else if (error instanceof GitHubFetchReleasesError) {
    serialized.kind = "githubFetchReleases";
    serialized.addonId = error.addonId;
  } else if (error instanceof GitHubFetchRepositoryError) {
    serialized.kind = "githubFetchRepository";
    serialized.addonId = error.addonId;
  } else if (error instanceof AssetMissingError) {
    serialized.kind = "assetMissing";
    serialized.clientGroup = error.clientGroup;
  } else if (error instanceof NoReleaseFoundError) {
    serialized.kind = "noReleaseFound";
  } else if (error instanceof TocNotFoundError) {
    serialized.kind = "tocNotFound";
  }

  // wowup-lib-core's and src/common's error containers both carry these
  if (error instanceof GenericProviderError || error instanceof ErrorContainer) {
    serialized.warningType = error.warningType;
    if (error.innerError) {
      serialized.innerError = serializeProviderError(error.innerError);
    }
  }

  return serialized;
}
