import { HttpErrorResponse } from "@angular/common/http";
import {
  AdPageOptions,
  Addon,
  AddonCategory,
  AddonChannelType,
  AddonFolder,
  AddonProvider,
  AddonSearchResult,
  DownloadAuth,
  GenericProviderError,
  GetAllBatchResult,
  GetAllResult,
  ProtocolSearchResult,
  SearchByUrlResult,
  SourceRemovedAddonError,
  WowInstallation,
} from "wowup-lib-core";

import {
  AssetMissingError,
  GitHubFetchReleasesError,
  GitHubFetchRepositoryError,
  GitHubLimitError,
  NoReleaseFoundError,
  TocNotFoundError,
} from "../../common/errors";
import {
  AddonProviderDescriptor,
  AddonProviderMethod,
  SerializedProviderError,
} from "../../common/models/addon-provider";
import { AddonProviderApiService } from "../services/api/addon-provider-api.service";

/** Rebuilds an error main flattened for ipc (`serializeProviderError`) as the class callers check for */
export function reviveProviderError(serialized: SerializedProviderError): Error {
  const innerError = serialized.innerError ? reviveProviderError(serialized.innerError) : undefined;

  let error: Error;
  switch (serialized.kind) {
    case "http":
      // What Angular's HttpClient threw when these providers ran here; callers still branch on it
      return new HttpErrorResponse({
        status: serialized.status,
        statusText: serialized.statusText,
        url: serialized.url,
        error: serialized.message,
      });
    case "sourceRemoved":
      error = new SourceRemovedAddonError(serialized.addonId ?? "", innerError);
      break;
    case "provider":
      error = new GenericProviderError(innerError, serialized.message, serialized.warningType);
      break;
    case "githubLimit": {
      const limit = serialized.rateLimit ?? { max: NaN, used: NaN, remaining: NaN, reset: NaN };
      error = new GitHubLimitError(limit.max, limit.used, limit.remaining, limit.reset, serialized.message);
      break;
    }
    case "githubFetchReleases":
      error = new GitHubFetchReleasesError(serialized.addonId ?? "", innerError);
      break;
    case "githubFetchRepository":
      error = new GitHubFetchRepositoryError(serialized.addonId ?? "", innerError);
      break;
    case "assetMissing":
      error = new AssetMissingError(serialized.message, serialized.clientGroup);
      break;
    case "noReleaseFound":
      error = new NoReleaseFoundError(serialized.message);
      break;
    case "tocNotFound":
      error = new TocNotFoundError(serialized.message);
      break;
    default:
      error = new Error(serialized.message);
      error.name = serialized.name;
  }

  if (serialized.code !== undefined) {
    (error as Error & { code?: string }).code = serialized.code;
  }
  return error;
}

/**
 * Stands in for a provider that runs in main, so the renderer's callers don't change while the
 * providers move (UI_DECOUPLING_PLAN.md, Phase 5b). Each method is one ipc call.
 *
 * The synchronous checks (`isValidAddonUri`, `isValidProtocol`, `shouldMigrate`) can't wait on ipc;
 * go through `AddonProviderFactory` for those, which asks main.
 */
export class RemoteAddonProvider extends AddonProvider {
  private readonly _adPageParams?: AdPageOptions;

  public constructor(
    descriptor: AddonProviderDescriptor,
    private readonly _api: AddonProviderApiService,
  ) {
    super();
    this.name = descriptor.name;
    this.enabled = descriptor.enabled;
    this.forceIgnore = descriptor.forceIgnore;
    this.allowReinstall = descriptor.allowReinstall;
    this.allowChannelChange = descriptor.allowChannelChange;
    this.allowEdit = descriptor.allowEdit;
    this.allowViewAtSource = descriptor.allowViewAtSource;
    this.allowReScan = descriptor.allowReScan;
    this.canShowChangelog = descriptor.canShowChangelog;
    this.canBatchFetch = descriptor.canBatchFetch;
    this.authRequired = descriptor.authRequired;
    this.adRequired = descriptor.adRequired;
    this.providerNote = descriptor.providerNote;
    this._adPageParams = descriptor.adPageParams;
  }

  public override getAdPageParams(): AdPageOptions | undefined {
    return this._adPageParams;
  }

  public override async getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
    const result = await this.call<GetAllBatchResult>("getAllBatch", installations, addonIds);
    const errors: GetAllBatchResult["errors"] = {};
    for (const [installationId, installationErrors] of Object.entries(result.errors)) {
      errors[installationId] = (installationErrors as unknown as SerializedProviderError[]).map(reviveProviderError);
    }
    return { ...result, errors };
  }

  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const result = await this.call<GetAllResult>("getAll", installation, addonIds);
    return {
      ...result,
      errors: (result.errors as unknown as SerializedProviderError[]).map(reviveProviderError),
    };
  }

  public override getFeaturedAddons(
    installation: WowInstallation,
    channelType?: AddonChannelType,
  ): Promise<AddonSearchResult[]> {
    return this.call("getFeaturedAddons", installation, channelType);
  }

  public override searchByQuery(
    query: string,
    installation: WowInstallation,
    channelType?: AddonChannelType,
  ): Promise<AddonSearchResult[]> {
    return this.call("searchByQuery", query, installation, channelType);
  }

  public override searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult | undefined> {
    return this.call("searchByUrl", addonUri.toString(), installation);
  }

  public override searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    return this.call("searchProtocol", protocol);
  }

  public override getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    return this.call("getCategory", category, installation);
  }

  public override getById(addonId: string, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    return this.call("getById", addonId, installation);
  }

  /** Main fills in its own copies of the folders; their matches are copied back onto the caller's */
  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    const matches = await this.call<(Addon | undefined)[]>("scan", installation, addonChannelType, addonFolders);
    matches.forEach((match, index) => {
      if (match !== undefined && addonFolders[index]) {
        addonFolders[index].matchingAddon = match;
      }
    });
  }

  public override getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string,
  ): Promise<string> {
    return this.call("getChangelog", installation, externalId, externalReleaseId);
  }

  public override getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    return this.call("getDescription", installation, externalId, addon);
  }

  public override getDownloadAuth(): Promise<DownloadAuth | undefined> {
    return this.call("getDownloadAuth");
  }

  /** The hub's own lookup: addon id by folder fingerprint */
  public getAddonIdsByFingerprints(fingerprints: string[]): Promise<Map<string, string>> {
    return this.call("getAddonIdsByFingerprints", fingerprints);
  }

  /** Async, unlike the base method: see `AddonProviderFactory.shouldMigrate` */
  public shouldMigrateAsync(addon: Addon): Promise<boolean> {
    return this.call("shouldMigrate", addon);
  }

  public override shouldMigrate(): boolean {
    throw new Error(`${this.name} runs in main, use AddonProviderFactory.shouldMigrate`);
  }

  public override isValidAddonUri(): boolean {
    throw new Error(`${this.name} runs in main, use AddonProviderFactory.getAddonProviderForUri`);
  }

  public override isValidProtocol(): boolean {
    throw new Error(`${this.name} runs in main, use AddonProviderFactory.getAddonProviderForProtocol`);
  }

  public override isValidAddonId(): boolean {
    throw new Error(`${this.name} runs in main and can't check ids here`);
  }

  private async call<T>(method: AddonProviderMethod, ...args: unknown[]): Promise<T> {
    const result = await this._api.call({ providerName: this.name, method, args });
    if ("error" in result) {
      throw reviveProviderError(result.error);
    }
    return result.value as T;
  }
}
