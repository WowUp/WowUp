export * from "./install-error";
import { CustomError } from "ts-custom-error";

export class ClassicAssetMissingError extends CustomError {}

export class AssetMissingError extends CustomError {}

export class NoReleaseFoundError extends CustomError {}

export class AddonSyncError extends CustomError {
  private readonly _innerError: CustomError;
  private readonly _providerName: string;

  constructor(providerName: string, innerError?: CustomError, message?: string) {
    super(message);

    this._providerName = providerName;
    this._innerError = innerError;
  }

  getInnerError() {
    return this._innerError;
  }

  getProviderName() {
    return this._providerName;
  }
}

export class GitHubLimitError extends CustomError {
  private readonly _rateLimitMax: number;
  private readonly _rateLimitUsed: number;
  private readonly _rateLimitRemaining: number;
  private readonly _rateLimitReset: number;

  constructor(max: number, used: number, remaining: number, reset: number, message?: string) {
    super(message);

    this._rateLimitMax = max;
    this._rateLimitUsed = used;
    this._rateLimitRemaining = remaining;
    this._rateLimitReset = reset;
  }

  getRateLimitMax() {
    return this._rateLimitMax;
  }

  getRateLimitUsed() {
    return this._rateLimitUsed;
  }

  getRateLimitRemaining() {
    return this._rateLimitRemaining;
  }

  getRateLimitReset() {
    return this._rateLimitReset;
  }
}
