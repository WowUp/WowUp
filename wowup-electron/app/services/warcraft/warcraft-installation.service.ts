import * as Store from "electron-store";
import * as log from "electron-log/main";

import { WowClientType, WowInstallation } from "wowup-lib-core";

import { WOW_FOREVER_FOLDER, WOW_INSTALLATIONS_KEY } from "../../../src/common/constants";
import { normalizeInstallationPath } from "../../../src/common/warcraft";

/** Stored Warcraft installations: CRUD over the preference store. */
export class WarcraftInstallationService {
  public constructor(private readonly preferenceStore: Store) {}

  public getAll(): WowInstallation[] {
    const installations = (this.preferenceStore.get(WOW_INSTALLATIONS_KEY) as WowInstallation[] | undefined) ?? [];
    return this.migrateForeverInstallations(installations);
  }

  public setAll(installations: WowInstallation[]): WowInstallation[] {
    this.preferenceStore.set(WOW_INSTALLATIONS_KEY, installations);
    return installations;
  }

  public add(installation: WowInstallation): WowInstallation[] {
    const installations = this.getAll();
    const normalizedLocation = normalizeInstallationPath(installation.location);
    const exists = installations.some((inst) => normalizeInstallationPath(inst.location) === normalizedLocation);
    if (exists) {
      throw new Error(`Installation already exists: ${installation.location}`);
    }

    installations.push(installation);

    return this.setAll(installations);
  }

  public remove(installationId: string): WowInstallation[] {
    const installations = this.getAll();
    const exists = installations.some((inst) => inst.id === installationId);
    if (!exists) {
      throw new Error(`Installation does not exist: ${installationId}`);
    }

    return this.setAll(installations.filter((inst) => inst.id !== installationId));
  }

  public update(installation: WowInstallation): WowInstallation[] {
    const installations = this.getAll();
    const matchIndex = installations.findIndex((inst) => inst.id === installation.id);
    if (matchIndex === -1) {
      throw new Error("No installation to update");
    }

    installations.splice(matchIndex, 1, installation);

    return this.setAll(installations);
  }

  public reorder(installationId: string, direction: number): WowInstallation[] {
    const installations = this.getAll();
    const originIndex = installations.findIndex((inst) => inst.id === installationId);
    if (originIndex === -1) {
      return installations;
    }

    const newIndex = originIndex + direction;
    if (newIndex < 0 || newIndex >= installations.length) {
      return installations;
    }

    [installations[newIndex], installations[originIndex]] = [installations[originIndex], installations[newIndex]];

    return this.setAll(installations);
  }

  public setSelected(installationId: string): WowInstallation[] {
    const installations = this.getAll();
    for (const installation of installations) {
      installation.selected = installation.id === installationId;
    }

    return this.setAll(installations);
  }

  // WoW Forever ships the retail binary, so before it was detected by folder, picking
  // _forever_/Wow.exe by hand was saved as a Retail installation. Fix those up in place.
  private migrateForeverInstallations(installations: WowInstallation[]): WowInstallation[] {
    let changed = false;
    for (const installation of installations) {
      if (installation.clientType === WowClientType.Retail && isInForeverFolder(installation.location)) {
        log.info(`Migrating WoW Forever installation saved as Retail: ${installation.location}`);
        installation.clientType = WowClientType.Forever;
        changed = true;
      }
    }

    return changed ? this.setAll(installations) : installations;
  }
}

function isInForeverFolder(location: string): boolean {
  return location.toLowerCase().split(/[\\/]/).includes(WOW_FOREVER_FOLDER);
}
