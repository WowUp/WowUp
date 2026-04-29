import { ipcMain } from "electron";
import * as Store from "electron-store";
import * as log from "electron-log/main";
import { Addon } from "wowup-lib-core";

import {
  IPC_ADDONS_GET_ALL,
  IPC_ADDONS_GET_ALL_FOR_INSTALLATION,
  IPC_ADDONS_GET_ALL_FOR_PROVIDER,
  IPC_ADDONS_GET_AUTO_UPDATE_ENABLED,
  IPC_ADDONS_GET_AVAILABLE_FOR_UPDATE,
  IPC_ADDONS_GET_BY_EXTERNAL_ID,
  IPC_ADDONS_GET_BY_EXTERNAL_IDS,
  IPC_ADDONS_SAVE_ALL,
} from "../../src/common/constants";
import { IpcController } from "./ipc-controller";

export class AddonController implements IpcController {
  public constructor(private readonly addonStore: Store) {}

  public register(): void {
    ipcMain.handle(IPC_ADDONS_SAVE_ALL, (_evt, addons: Addon[]) => this.saveAll(addons));
    ipcMain.handle(IPC_ADDONS_GET_ALL, () => this.getAll());
    ipcMain.handle(IPC_ADDONS_GET_ALL_FOR_INSTALLATION, (_evt, installationId: string) => this.getAllForInstallation(installationId));
    ipcMain.handle(IPC_ADDONS_GET_ALL_FOR_PROVIDER, (_evt, providerName: string) => this.getAllForProvider(providerName));
    ipcMain.handle(IPC_ADDONS_GET_BY_EXTERNAL_ID, (_evt, externalId: string, providerName: string, installationId: string) => this.getByExternalId(externalId, providerName, installationId));
    ipcMain.handle(IPC_ADDONS_GET_BY_EXTERNAL_IDS, (_evt, externalIds: string[]) => this.getByExternalIds(externalIds));
    ipcMain.handle(IPC_ADDONS_GET_AVAILABLE_FOR_UPDATE, (_evt, installationId?: string) => this.getAvailableForUpdate(installationId));
    ipcMain.handle(IPC_ADDONS_GET_AUTO_UPDATE_ENABLED, () => this.getAutoUpdateEnabled());
  }

  private getAll(): Addon[] {
    return [...this.addonStore].map(([, addon]) => addon as Addon);
  }

  private getAllForInstallation(installationId: string): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      if ((addon as Addon).installationId === installationId) {
        addons.push(addon as Addon);
      }
    }
    return addons;
  }

  private getAllForProvider(providerName: string): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      if ((addon as Addon).providerName === providerName) {
        addons.push(addon as Addon);
      }
    }
    return addons;
  }

  private getByExternalId(externalId: string, providerName: string, installationId: string): Addon | undefined {
    for (const [, addon] of this.addonStore) {
      const a = addon as Addon;
      if (a.installationId === installationId && a.externalId === externalId && a.providerName === providerName) {
        return a;
      }
    }
    return undefined;
  }

  private getByExternalIds(externalIds: string[]): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      const a = addon as Addon;
      if (a.externalId && externalIds.includes(a.externalId)) {
        addons.push(a);
      }
    }
    return addons;
  }

  private getAvailableForUpdate(installationId?: string): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      const a = addon as Addon;
      if (installationId && a.installationId !== installationId) {
        continue;
      }
      if (a.isIgnored !== true && this.needsUpdate(a)) {
        addons.push(a);
      }
    }
    return addons;
  }

  private getAutoUpdateEnabled(): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      const a = addon as Addon;
      if (a.isIgnored !== true && a.autoUpdateEnabled && !!a.installationId) {
        addons.push(a);
      }
    }
    return addons;
  }

  private needsUpdate(addon: Addon): boolean {
    if (addon.isIgnored) {
      return false;
    }
    if (addon.externalLatestReleaseId && addon.externalLatestReleaseId !== addon.installedExternalReleaseId) {
      return true;
    }
    const installedVer = (addon.installedVersion ?? "").replace(/^v/i, "");
    const latestVer = (addon.latestVersion ?? "").replace(/^v/i, "");
    return installedVer.length > 0 && installedVer !== latestVer;
  }

  private saveAll(addons: Addon[]): void {
    if (!Array.isArray(addons)) {
      return;
    }

    // Dedupe in-memory by (installationId, providerName, externalId) — guards
    // against a parallel-rescan race where two scans each wrote a fresh UUID
    // for the same logical addon and persisted both, leaving the user with
    // every addon listed twice in My Addons.
    const seen = new Map<string, Addon>();
    for (const addon of addons) {
      if (typeof addon.id !== "string") {
        log.warn("malformed addon not saved", addon);
        continue;
      }
      const key = `${addon.installationId ?? ""}|${addon.providerName ?? ""}|${addon.externalId ?? ""}`;
      seen.set(key, addon);
    }

    for (const addon of seen.values()) {
      this.addonStore.set(addon.id, addon);
    }

    // Scrub any pre-existing duplicates in the store that match the
    // (installationId, providerName, externalId) of an addon we're saving but
    // live under a stale UUID. One pass is enough — every save heals.
    if (seen.size === 0) {
      return;
    }

    const staleIds: string[] = [];
    for (const [storedId, stored] of this.addonStore) {
      const a = stored as Addon;
      if (typeof a?.installationId !== "string" || typeof storedId !== "string") {
        continue;
      }
      const key = `${a.installationId}|${a.providerName ?? ""}|${a.externalId ?? ""}`;
      const winner = seen.get(key);
      if (winner && winner.id !== storedId) {
        staleIds.push(storedId);
      }
    }

    for (const id of staleIds) {
      this.addonStore.delete(id);
    }

    if (staleIds.length > 0) {
      log.info(`[addon-controller] removed ${staleIds.length} duplicate addon record(s)`);
    }
  }
}
