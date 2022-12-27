export * from "./install-error";
import { CustomError } from "ts-custom-error";
import { AddonWarningType, WowClientGroup } from "wowup-lib-core";

export class ErrorContainer extends CustomError {
  public readonly innerError?: Error;
  public readonly warningType?: AddonWarningType;

  public constructor(innerError?: Error, message?: string, warningType?: AddonWarningType) {
    super(message);
    this.innerError = innerError;
    this.warningType = warningType;
  }
}

export class AssetMissingError extends CustomError {
  public clientGroup?: WowClientGroup;

  public constructor(message?: string, clientGroup?: WowClientGroup) {
    super(message);

    this.clientGroup = clientGroup;
  }
}

export class NoReleaseFoundError extends CustomError {}

export interface AddonScanErrorConfig {
  providerName: string;
  innerError?: CustomError;
  message?: string;
  addonName?: string;
}

export class AddonScanError extends CustomError {
  public readonly innerError: CustomError | undefined;
  public readonly providerName: string;
  public readonly addonName?: string;

  public constructor(config: AddonScanErrorConfig) {
    super(config.message);

    this.providerName = config.providerName;
    this.innerError = config.innerError;
    this.addonName = config.addonName;
  }
}

export interface AddonSyncErrorConfig {
  providerName: string;
  innerError?: CustomError;
  message?: string;
  addonName?: string;
  installationName?: string;
}

export class AddonSyncError extends CustomError {
  public readonly innerError: CustomError | undefined;
  public readonly providerName: string;
  public readonly addonName?: string;
  public readonly installationName?: string;

  public constructor(config: AddonSyncErrorConfig) {
    super(config.message);

    this.providerName = config.providerName;
    this.innerError = config.innerError;
    this.addonName = config.addonName;
    this.installationName = config.installationName;
  }
}

export class GenericProviderError extends ErrorContainer {}

export class GitHubError extends ErrorContainer {}

export class GitHubLimitError extends GitHubError {
  public readonly rateLimitMax: number;
  public readonly rateLimitUsed: number;
  public readonly rateLimitRemaining: number;
  public readonly rateLimitReset: number;

  public constructor(max: number, used: number, remaining: number, reset: number, message?: string) {
    super(undefined, message);

    this.rateLimitMax = max;
    this.rateLimitUsed = used;
    this.rateLimitRemaining = remaining;
    this.rateLimitReset = reset;
  }
}

export class GitHubFetchReleasesError extends GitHubError {
  public readonly addonId: string;

  public constructor(addonId: string, error?: Error) {
    super(error);

    this.addonId = addonId;
  }
}

export class GitHubFetchRepositoryError extends GitHubError {
  public readonly addonId: string;

  public constructor(addonId: string, error?: Error) {
    super(error);

    this.addonId = addonId;
  }
}
