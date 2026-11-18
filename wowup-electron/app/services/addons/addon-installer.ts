import * as path from "path";
import slug = require("slug");
import { Addon, AddonProvider, DownloadAuth, GenericProviderError, WowInstallation } from "wowup-lib-core";

import { ADDON_PROVIDER_HUB } from "../../../src/common/constants";
import { AddonInstallPhase, InstallAddonRequest, InstalledAddonFile } from "../../../src/common/models/addon-install";
import {
  AddonScanRequest,
  AddonSyncFailure,
  AppliedAddonSync,
  ApplyAddonSyncRequest,
  FolderScanResults,
} from "../../../src/common/models/addon-scan";
import { ProviderLookup } from "../addon-providers/addon-provider-registry";
import { WowUpAddonProvider } from "../addon-providers/wowup-addon-provider";
import { AddonInstallService } from "./addon-install.service";

/** Download attempts after the first one fails */
export const DOWNLOAD_RETRIES = 3;
/** Wait after re-syncing the addon, on top of the backoff, as the renderer's retry did */
const RESYNC_SETTLE_MS = 1000;

export interface InstallerDownloadOptions {
  url: string;
  fileName: string;
  outputFolder: string;
  auth?: DownloadAuth;
}

export interface AddonInstallerDeps {
  /** Undefined until the renderer has sent the providers' config */
  getProviders: () => ProviderLookup | undefined;
  installService: Pick<AddonInstallService, "installFile" | "addExternalId">;
  applySync: (request: ApplyAddonSyncRequest) => AppliedAddonSync;
  /** Saves the file in the output folder and resolves to its path */
  download: (options: InstallerDownloadOptions) => Promise<string>;
  getInstallations: () => WowInstallation[];
  getAddonFolderPath: (installation: WowInstallation) => string;
  getFingerprints: (request: AddonScanRequest) => Promise<FolderScanResults[]>;
  /** Where addon zips are saved; the install service only unzips from here */
  downloadsFolderPath: string;
  /** Delete a file; one that isn't there is not an error */
  removeFile: (filePath: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  log: { info(...args: unknown[]): void; error(...args: unknown[]): void };
}

/**
 * Installs an addon from its provider: downloads it, retrying a failed download after re-syncing the
 * addon (a provider's download url can expire), hands the zip to `AddonInstallService`, then asks the
 * hub for the addon's hub id.
 */
export class AddonInstaller {
  public constructor(private readonly deps: AddonInstallerDeps) {}

  public async installAddon(
    request: InstallAddonRequest,
    onPhase: (phase: AddonInstallPhase) => void = () => {},
  ): Promise<InstalledAddonFile> {
    const addon = { ...request.addon };
    const providers = this.deps.getProviders();
    if (!providers) {
      throw new Error("Addon providers are not initialized");
    }

    const installation = this.deps.getInstallations().find((i) => i.id === addon.installationId);
    if (!installation) {
      throw new Error(`Installation not found: ${addon.installationId ?? ""}`);
    }

    const provider = providers.getProvider(addon.providerName ?? "");
    if (!provider) {
      throw new Error(`Addon provider not found: ${addon.providerName ?? ""}`);
    }

    onPhase("downloading");
    const zipFilePath = await this.download(addon, installation, provider, onPhase);
    try {
      const installed = await this.deps.installService.installFile(
        {
          addon,
          zipFilePath,
          originalAddon: request.originalAddon,
          forceIgnore: provider.forceIgnore,
          providerNames: providers.getProviderNames(),
        },
        onPhase,
      );

      await this.addHubExternalId(installed.addon, installation, providers);
      return installed;
    } finally {
      // installFile deletes the zip itself; this covers a failure before it got that far
      await this.deps.removeFile(zipFilePath);
    }
  }

  private async download(
    addon: Addon,
    installation: WowInstallation,
    provider: AddonProvider,
    onPhase: (phase: AddonInstallPhase) => void,
  ): Promise<string> {
    const auth = await provider.getDownloadAuth();
    const fileName = `${slug(addon.name)}.zip`;

    for (let retry = 0; ; retry++) {
      try {
        return await this.deps.download({
          url: addon.downloadUrl ?? "",
          fileName,
          outputFolder: this.deps.downloadsFolderPath,
          auth,
        });
      } catch (e) {
        if (retry === DOWNLOAD_RETRIES) {
          throw e;
        }

        const backoffMs = 1000 * Math.pow(2, retry);
        this.deps.log.info(`install download failed, retry ${retry + 1} in ${backoffMs}ms`, e);
        onPhase("retry");
        await this.resync(addon, installation, provider);
        await this.deps.delay(RESYNC_SETTLE_MS + backoffMs);
      }
    }
  }

  /** Ask the provider about the addon again, which can hand it a fresh download url */
  private async resync(addon: Addon, installation: WowInstallation, provider: AddonProvider): Promise<void> {
    if (!addon.externalId) {
      return;
    }

    try {
      const { searchResults, errors } = await provider.getAll(installation, [addon.externalId]);
      const failures: AddonSyncFailure[] = errors.map((error) => ({
        addonId: (error as { addonId?: string }).addonId,
        warningType: error instanceof GenericProviderError ? error.warningType : undefined,
      }));

      const applied = this.deps.applySync({ providerName: provider.name, addons: [addon], searchResults, failures });
      const updated = applied.addons.find((a) => a.id === addon.id);
      if (updated) {
        Object.assign(addon, updated);
      }
    } catch (e) {
      // The retry still goes ahead with the url the addon had
      this.deps.log.error(`Failed to re-sync ${addon.name} before retrying its download`, e);
    }
  }

  /**
   * The hub has no toc field and can only be matched by fingerprint, so an addon installed from
   * another provider never learns its hub id from its tocs. Ask the hub about the installed
   * folders instead. Best effort: a hub failure must never fail the install.
   */
  private async addHubExternalId(
    addon: Addon,
    installation: WowInstallation,
    providers: ProviderLookup,
  ): Promise<void> {
    if (
      addon.providerName === ADDON_PROVIDER_HUB ||
      !addon.installedFolderList?.length ||
      addon.externalIds?.some((extId) => extId.providerName === ADDON_PROVIDER_HUB) ||
      !providers.isEnabled(ADDON_PROVIDER_HUB)
    ) {
      return;
    }

    const hubProvider = providers.getProvider(ADDON_PROVIDER_HUB);
    if (!(hubProvider instanceof WowUpAddonProvider)) {
      return;
    }

    try {
      const addonFolderPath = this.deps.getAddonFolderPath(installation);
      const filePaths = addon.installedFolderList.map((folderName) => path.join(addonFolderPath, folderName));
      const scanResults = await this.deps.getFingerprints({ filePaths, sources: ["wowup"] });
      const fingerprints = scanResults.map((result) => result.wowup?.fingerprint).filter((fp): fp is string => !!fp);

      const hubIds = await hubProvider.getAddonIdsByFingerprints(fingerprints);
      const hubId = fingerprints.map((fp) => hubIds.get(fp)).find((id) => id !== undefined);
      if (!hubId) {
        return;
      }

      const externalIds = this.deps.installService.addExternalId({
        addonId: addon.id,
        providerName: ADDON_PROVIDER_HUB,
        externalId: hubId,
      });
      if (externalIds) {
        addon.externalIds = externalIds;
      }
    } catch (e) {
      this.deps.log.error(`Failed to look up hub id for ${addon.name}`, e);
    }
  }
}
