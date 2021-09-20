import { Injectable } from "@angular/core";
import { Addon } from "../../../common/entities/addon";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { getEnumName } from "../../utils/enum.utils";
import { AddonStorageService } from "../storage/addon-storage.service";

export type ExportReleaseType = "stable" | "beta" | "alpha";

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

@Injectable({
  providedIn: "root",
})
export class AddonBrokerService {
  public constructor(private _addonStorage: AddonStorageService) {}

  public getExportSummary(installation: WowInstallation): ExportSummary {
    const addons = this._addonStorage.getAllForInstallationId(installation.id);

    // If an addon is ignored, ignore it.
    const addonCt = addons.filter((addon) => !this.addonIsIgnored(addon)).length;

    // Count the ignored ones
    const ignoredCt = addons.filter((addon) => this.addonIsIgnored(addon)).length;

    return {
      activeCount: addonCt,
      ignoreCount: ignoredCt,
    };
  }

  public getExportPayload(installation: WowInstallation): ExportPayload {
    const payload: ExportPayload = {
      collection_name: `WowUp_export_${Date.now()}`,
      client_type: this.getClientType(installation.clientType),
      addons: [],
    };

    const addons = this._addonStorage
      .getAllForInstallationId(installation.id)
      .filter((addon) => !this.addonIsIgnored(addon));

    for (const addon of addons) {
      try {
        payload.addons.push(this.getExportAddon(addon));
      } catch (e) {
        console.error(e);
      }
    }

    return payload;
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
