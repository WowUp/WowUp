export * from "./install-error";
import { CustomError } from "ts-custom-error";

export class ClassicAssetMissingError extends CustomError {}

export class AssetMissingError extends CustomError {}

export class NoReleaseFoundError extends CustomError {}

export class AddonScanError extends CustomError {
  public readonly innerError: CustomError;
  public readonly providerName: string;

  constructor(providerName: string, innerError?: CustomError, message?: string) {
    super(message);

    this.providerName = providerName;
    this.innerError = innerError;
  }
}

export class AddonSyncError extends CustomError {
  public readonly innerError: CustomError;
  public readonly providerName: string;

  constructor(providerName: string, innerError?: CustomError, message?: string) {
    super(message);

    this.providerName = providerName;
    this.innerError = innerError;
  }
}

export class GitHubLimitError extends CustomError {
  public readonly rateLimitMax: number;
  public readonly rateLimitUsed: number;
  public readonly rateLimitRemaining: number;
  public readonly rateLimitReset: number;

  constructor(max: number, used: number, remaining: number, reset: number, message?: string) {
    super(message);

    this.rateLimitMax = max;
    this.rateLimitUsed = used;
    this.rateLimitRemaining = remaining;
    this.rateLimitReset = reset;
  }
}
