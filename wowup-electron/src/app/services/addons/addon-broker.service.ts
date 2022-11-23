import _ from "lodash";

import { Injectable } from "@angular/core";
import { nanoid } from "nanoid";

import { getWowClientGroup } from "../../../common/warcraft";
import { getEnumName } from "wowup-lib-core/lib/utils";
import { AddonStorageService } from "../storage/addon-storage.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { AddonService } from "./addon.service";
import { Subject } from "rxjs";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { ElectronService } from "..";
import { Addon, WowClientType, WowInstallation } from "wowup-lib-core";

export type ExportReleaseType = "stable" | "beta" | "alpha";
export type ImportState = "no-change" | "added" | "conflict";
export type ConflictReasonCode = "VERSION_MISMATCH" | "PROVIDER_MISMATCH";
export type ImportErrorCode = "GENERIC_IMPORT_ERROR" | "INVALID_CLIENT_TYPE";

export interface ExportSummary {
  activeCount: number;
  ignoreCount: number;
}

export interface ExportAddon {
  name: string;
  provider_name: string;
  id: string;
  version_id?: string;
  release_type?: ExportReleaseType;
}

export interface ExportPayload {
  collection_name?: string;
  client_type: string;
  addons: ExportAddon[];
}

export interface ImportSummary {
  addedCt: number;
  noChangeCt: number;
  conflictCt: number;
  comparisons: ImportComparison[];
  errorCode?: ImportErrorCode;
}

export interface ImportComparison {
  id: string;
  original?: ExportAddon;
  imported: ExportAddon;
  state: ImportState;
  conflictReason?: ConflictReasonCode;
}

export interface InstallEvent {
  comparisonId: string;
  installState: AddonInstallState;
  progress: number;
}

const ImportStateWeights: { [key: string]: number } = {
  "no-change": 0,
  added: 1,
  conflict: 2,
};

@Injectable({
  providedIn: "root",
})
export class AddonBrokerService {
  private readonly _addonInstallSrc = new Subject<InstallEvent>();

  public readonly addonInstall$ = this._addonInstallSrc.asObservable();

  public constructor(
    private _addonStorage: AddonStorageService,
    private _addonService: AddonService,
    private _warcraftService: WarcraftService,
    private _electronService: ElectronService
  ) {}

  public async getExportSummary(installation: WowInstallation): Promise<ExportSummary> {
    const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);

    // If an addon is ignored, ignore it.
    const addonCt = addons.filter((addon) => !this.addonIsIgnored(addon)).length;

    // Count the ignored ones
    const ignoredCt = addons.filter((addon) => this.addonIsIgnored(addon)).length;

    return {
      activeCount: addonCt,
      ignoreCount: ignoredCt,
    };
  }

  public async getExportPayload(installation: WowInstallation): Promise<ExportPayload> {
    const payload: ExportPayload = {
      collection_name: `WowUp_export_${Date.now()}`,
      client_type: this.getClientType(installation.clientType),
      addons: [],
    };

    let addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
    addons = addons.filter((addon) => !this.addonIsIgnored(addon));

    for (const addon of addons) {
      try {
        payload.addons.push(this.getExportAddon(addon));
      } catch (e) {
        console.error(e);
      }
    }

    return payload;
  }

  public async parseImportString(importStr: string): Promise<ExportPayload> {
    let jsonStr: string = importStr;
    // try to detect JSON vs b64 json
    if (importStr.trim().charAt(0) !== "{") {
      // try to decode it from b64
      jsonStr = await this._electronService.invoke("base64-decode", jsonStr);
    }

    const importJson: ExportPayload = JSON.parse(jsonStr);
    return importJson;
  }

  public async installImportSummary(importSummary: ImportSummary, installation: WowInstallation): Promise<void> {
    const comps = importSummary.comparisons.filter((comp) => comp.state === "added");

    const tasks = comps.map((comp) => {
      return (async (c) => {
        try {
          await this._addonService.installBaseAddon(
            c.imported.id,
            c.imported.provider_name,
            installation,
            (installState, progress) => {
              this._addonInstallSrc.next({
                comparisonId: c.id,
                installState,
                progress,
              });
            }
          );
        } catch (e) {
          console.error(`Failed to install imported addon`, e);
        }
      })(comp);
    });

    await Promise.all(tasks);
  }

  public async getImportSummary(exportPayload: ExportPayload, installation: WowInstallation): Promise<ImportSummary> {
    const summary: ImportSummary = {
      addedCt: 0,
      conflictCt: 0,
      noChangeCt: 0,
      comparisons: [],
    };

    if (!Array.isArray(exportPayload.addons) || exportPayload.addons.length === 0) {
      summary.errorCode = "GENERIC_IMPORT_ERROR";
      return summary;
    }

    if (!this.isSameClient(installation.clientType, exportPayload.client_type)) {
      summary.errorCode = "INVALID_CLIENT_TYPE";
      return summary;
    }

    const currentAddons = await this._addonService.getAllAddons(installation);
    for (const impAddon of exportPayload.addons) {
      const comparison: ImportComparison = {
        id: nanoid(),
        imported: impAddon,
        state: "added",
      };

      const externalIdMatch = currentAddons.find(
        (addon) => addon.externalId === impAddon.id && addon.providerName == impAddon.provider_name
      );
      if (externalIdMatch) {
        comparison.original = {
          id: externalIdMatch.externalId,
          name: externalIdMatch.name,
          provider_name: externalIdMatch.providerName,
          version_id: externalIdMatch.installedExternalReleaseId,
        };
      } else {
        const nameMatch = currentAddons.find(
          (addon) => impAddon.name.length > 0 && addon.name.toLowerCase() === impAddon.name.toLowerCase()
        );
        if (nameMatch) {
          comparison.original = {
            id: nameMatch.externalId,
            name: nameMatch.name,
            provider_name: nameMatch.providerName,
            version_id: nameMatch.installedExternalReleaseId,
          };
        }
      }

      const [state, reason] = this.getImportState(comparison);
      comparison.state = state;
      comparison.conflictReason = reason;

      summary.comparisons.push(comparison);
    }

    summary.addedCt = summary.comparisons.reduce(function (n, val) {
      return n + (val.state === "added" ? 1 : 0);
    }, 0);

    summary.conflictCt = summary.comparisons.reduce(function (n, val) {
      return n + (val.state === "conflict" ? 1 : 0);
    }, 0);

    summary.noChangeCt = summary.comparisons.reduce(function (n, val) {
      return n + (val.state === "no-change" ? 1 : 0);
    }, 0);

    // sort the results for better display
    summary.comparisons = _.sortBy(summary.comparisons, (comp) => ImportStateWeights[comp.state]).reverse();

    return summary;
  }

  private isSameClient(srcClient: WowClientType, targetClient: string) {
    const srcGroup = getWowClientGroup(srcClient);
    const targetGroup = getWowClientGroup(targetClient);

    return srcGroup === targetGroup;
  }

  private getImportState(comparison: ImportComparison): [ImportState, ConflictReasonCode | undefined] {
    if (comparison.imported && comparison.original) {
      if (comparison.imported.provider_name !== comparison.original.provider_name) {
        return ["conflict", "PROVIDER_MISMATCH"];
      }

      return comparison.imported.version_id !== comparison.original.version_id
        ? ["conflict", "VERSION_MISMATCH"]
        : ["no-change", undefined];
    }

    return ["added", undefined];
  }

  private getExportAddon(addon: Addon): ExportAddon {
    if (!addon.externalId) {
      throw new Error(`Addon externalId missing, cannot export: ${addon.name}`);
    }

    const exportAddon: ExportAddon = {
      id: addon.externalId,
      name: addon.name,
      provider_name: addon.providerName,
      // release_type: addon.channelType
      version_id: addon.installedExternalReleaseId ?? undefined,
    };

    return exportAddon;
  }

  private getClientType(clientType: WowClientType): string {
    return getEnumName(WowClientType, clientType);
  }

  private addonIsIgnored(addon: Addon): boolean {
    return addon.isIgnored !== false;
  }
}
