import * as Store from "electron-store";
import * as log from "electron-log/main";
import { Addon } from "wowup-lib-core";

/** The addons electron-store, keyed by addon id. The one place in main that reads or writes it. */
export class AddonRepository {
  public constructor(private readonly addonStore: Store) {}

  public getAll(): Addon[] {
    return [...this.addonStore].map(([, addon]) => addon as Addon);
  }

  public getById(addonId: string | undefined): Addon | undefined {
    if (typeof addonId !== "string") {
      return undefined;
    }
    return this.addonStore.get(addonId) as Addon | undefined;
  }

  public getAllForInstallation(installationId: string): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      if ((addon as Addon).installationId === installationId) {
        addons.push(addon as Addon);
      }
    }
    return addons;
  }

  public getAllForProvider(providerName: string): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      if ((addon as Addon).providerName === providerName) {
        addons.push(addon as Addon);
      }
    }
    return addons;
  }

  public getByExternalId(externalId: string, providerName: string, installationId: string): Addon | undefined {
    for (const [, addon] of this.addonStore) {
      const a = addon as Addon;
      if (a.installationId === installationId && a.externalId === externalId && a.providerName === providerName) {
        return a;
      }
    }
    return undefined;
  }

  public getByExternalIds(externalIds: string[]): Addon[] {
    const addons: Addon[] = [];
    for (const [, addon] of this.addonStore) {
      const a = addon as Addon;
      if (a.externalId && externalIds.includes(a.externalId)) {
        addons.push(a);
      }
    }
    return addons;
  }

  public getAvailableForUpdate(installationId?: string): Addon[] {
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

  public getAutoUpdateEnabled(): Addon[] {
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

  /**
   * Swap an installation's addons for a new set in one step, so two overlapping rescans
   * can't each delete before the other saves and leave both sets behind (#1561).
   */
  public replaceAllForInstallation(installationId: string, addons: Addon[]): void {
    if (typeof installationId !== "string" || !Array.isArray(addons)) {
      return;
    }

    for (const [key, addon] of [...this.addonStore]) {
      if ((addon as Addon).installationId === installationId) {
        this.addonStore.delete(key);
      }
    }

    this.saveAll(addons);
  }

  public removeById(addonId: string | undefined): void {
    if (typeof addonId === "string") {
      this.addonStore.delete(addonId);
    }
  }

  public saveAll(addons: Addon[]): void {
    if (!Array.isArray(addons)) {
      return;
    }

    for (const addon of addons) {
      if (typeof addon.id !== "string") {
        log.warn("malformed addon not saved", addon);
        continue;
      }

      this.addonStore.set(addon.id, addon);
    }
  }
}
