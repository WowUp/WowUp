export * from "./install-error";
import { CustomError } from "ts-custom-error";

export class ErrorContainer extends CustomError {
  public readonly innerError?: Error;

  constructor(innerError?: Error, message?: string) {
    super(message);
    this.innerError = innerError;
  }
}

export class ClassicAssetMissingError extends CustomError {}

export class AssetMissingError extends CustomError {}

export class NoReleaseFoundError extends CustomError {}

export interface AddonScanErrorConfig {
  providerName: string;
  innerError?: CustomError;
  message?: string;
  addonName?: string;
}

export class AddonScanError extends CustomError {
  public readonly innerError: CustomError;
  public readonly providerName: string;
  public readonly addonName?: string;

  constructor(config: AddonScanErrorConfig) {
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
}

export class AddonSyncError extends CustomError {
  public readonly innerError: CustomError;
  public readonly providerName: string;
  public readonly addonName?: string;

  constructor(config: AddonSyncErrorConfig) {
    super(config.message);

    this.providerName = config.providerName;
    this.innerError = config.innerError;
    this.addonName = config.addonName;
  }
}

export class GitHubError extends ErrorContainer {}

export class GitHubLimitError extends GitHubError {
  public readonly rateLimitMax: number;
  public readonly rateLimitUsed: number;
  public readonly rateLimitRemaining: number;
  public readonly rateLimitReset: number;

  constructor(max: number, used: number, remaining: number, reset: number, message?: string) {
    super(undefined, message);

    this.rateLimitMax = max;
    this.rateLimitUsed = used;
    this.rateLimitRemaining = remaining;
    this.rateLimitReset = reset;
  }
}

export class GitHubFetchReleasesError extends GitHubError {
  public readonly addonId: string;

  constructor(addonId: string, error?: Error) {
    super(error);

    this.addonId = addonId;
  }
}

export class GitHubFetchRepositoryError extends GitHubError {
  public readonly addonId: string;

  constructor(addonId: string, error?: Error) {
    super(error);

    this.addonId = addonId;
  }
}
