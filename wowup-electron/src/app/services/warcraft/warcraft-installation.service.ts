import * as _ from "lodash";
import * as path from "path";
import { from, ReplaySubject, Subject } from "rxjs";
import { map, tap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import {
  DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
  WOW_INSTALLATIONS_KEY,
} from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../../common/wowup/models";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
import { getEnumName } from "../../utils/enum.utils";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftService } from "./warcraft.service";

@Injectable({
  providedIn: "root",
})
export class WarcraftInstallationService {
  private readonly _wowInstallationsSrc = new ReplaySubject<WowInstallation[]>(1);
  private readonly _legacyInstallationSrc = new Subject<WowInstallation[]>();

  private _wowInstallations: WowInstallation[] = [];
  private _blizzardAgentPath = "";

  public readonly wowInstallations$ = this._wowInstallationsSrc.asObservable();
  public readonly legacyInstallationSrc$ = this._legacyInstallationSrc.asObservable();

  public get blizzardAgentPath(): string {
    return `${this._blizzardAgentPath}`;
  }

  public constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _warcraftService: WarcraftService,
    private _translateService: TranslateService,
    private _fileService: FileService,
    private _electronService: ElectronService
  ) {
    this._wowInstallationsSrc.subscribe((installations) => {
      installations.forEach(installation => {
        // fallback to default label
        if (!installation.label) {
          const typeName = getEnumName(WowClientType, installation.clientType);
          this._translateService.get(`COMMON.CLIENT_TYPES.${typeName.toUpperCase()}`).subscribe(
            value => installation.label = value
          );
        }
      })
      this._wowInstallations = installations;
    });

    from(this._warcraftService.getBlizzardAgentPath())
      .pipe(
        tap((blizzardAgentPath) => {
          this._blizzardAgentPath = blizzardAgentPath;
        }),
        // switchMap((blizzardAgentPath) => this.migrateAllLegacyInstallations(blizzardAgentPath)),
        map((blizzardAgentPath) => this.importWowInstallations(blizzardAgentPath))
      )
      .subscribe();
  }

  public async reOrderInstallation(installationId: string, direction: number): Promise<void> {
    const originIndex = this._wowInstallations.findIndex((installation) => installation.id === installationId);
    if (originIndex === -1) {
      console.warn("Installation not found to re-order", installationId);
      return;
    }

    const newIndex = originIndex + direction;
    if (newIndex < 0 || newIndex >= this._wowInstallations.length) {
      console.warn("New index was out of bounds");
      return;
    }

    const installationCpy = [...this._wowInstallations];

    [installationCpy[newIndex], installationCpy[originIndex]] = [
      installationCpy[originIndex],
      installationCpy[newIndex],
    ];

    await this.setWowInstallations(installationCpy);
    this._wowInstallationsSrc.next(installationCpy);
  }

  public async getWowInstallationsAsync(): Promise<WowInstallation[]> {
    const results = await this._preferenceStorageService.getObjectAsync<WowInstallation[]>(WOW_INSTALLATIONS_KEY);
    return results || [];
  }

  public getWowInstallation(installationId: string | undefined): WowInstallation | undefined {
    if (!installationId) {
      console.warn("getWowInstallation invalid installationId");
      return undefined;
    }

    return this._wowInstallations.find((installation) => installation.id === installationId);
  }

  public async getWowInstallationsByClientType(clientType: WowClientType): Promise<WowInstallation[]> {
    const installations = await this.getWowInstallationsAsync();
    return _.filter(installations, (installation) => installation.clientType === clientType);
  }

  public async getWowInstallationsByClientTypes(clientTypes: WowClientType[]): Promise<WowInstallation[]> {
    const installations = await this.getWowInstallationsAsync();
    return _.filter(installations, (installation) => clientTypes.includes(installation.clientType));
  }

  public async setWowInstallations(wowInstallations: WowInstallation[]): Promise<void> {
    console.log(`Setting wow installations: ${wowInstallations.length}`);
    await this._preferenceStorageService.setAsync(WOW_INSTALLATIONS_KEY, wowInstallations);
  }

  public async setSelectedWowInstallation(wowInstallation: WowInstallation): Promise<void> {
    const allInstallations = await this.getWowInstallationsAsync();
    _.forEach(allInstallations, (installation) => {
      installation.selected = installation.id === wowInstallation.id;
    });

    await this.setWowInstallations(allInstallations);
  }

  public async updateWowInstallation(wowInstallation: WowInstallation): Promise<void> {
    const storedInstallations = await this.getWowInstallationsAsync();
    const matchIndex = _.findIndex(storedInstallations, (installation) => installation.id === wowInstallation.id);

    if (matchIndex === -1) {
      throw new Error("No installation to update");
    }

    storedInstallations.splice(matchIndex, 1, wowInstallation);

    await this.setWowInstallations(storedInstallations);
    this._wowInstallationsSrc.next(storedInstallations);
  }

  public async selectWowClientPath(): Promise<string> {
    const selectionName = this._translateService.instant("COMMON.WOW_EXE_SELECTION_NAME");
    const extensionFilter = this._warcraftService.getExecutableExtension();
    let dialogResult: Electron.OpenDialogReturnValue;
    if (extensionFilter) {
      dialogResult = await this._electronService.showOpenDialog({
        filters: [{ extensions: [extensionFilter], name: selectionName }],
        properties: ["openFile"],
      });
    } else {
      // platforms like linux don't really fit the rule
      dialogResult = await this._electronService.showOpenDialog({
        properties: ["openFile"],
      });
    }

    if (dialogResult.canceled) {
      return "";
    }

    const selectedPath = _.first(dialogResult.filePaths);
    if (!selectedPath || !selectedPath.endsWith("")) {
      console.warn("No path selected");
      return "";
    }

    return selectedPath;
  }

  public async addInstallation(installation: WowInstallation, notify = true): Promise<void> {
    const existingInstallations = await this.getWowInstallationsAsync();
    const exists = _.findIndex(existingInstallations, (inst) => inst.location === installation.location) !== -1;
    if (exists) {
      throw new Error(`Installation already exists: ${installation.location}`);
    }

    existingInstallations.push(installation);

    await this.setWowInstallations(existingInstallations);

    if (notify) {
      this._wowInstallationsSrc.next(existingInstallations);
    }
  }

  public async removeWowInstallation(installation: WowInstallation): Promise<void> {
    const installations = await this.getWowInstallationsAsync();
    const installationExists = _.findIndex(installations, (inst) => inst.id === installation.id) !== -1;
    if (!installationExists) {
      throw new Error(`Installation does not exist: ${installation.id}`);
    }

    _.remove(installations, (inst) => inst.id === installation.id);

    await this.setWowInstallations(installations);
    this._wowInstallationsSrc.next(installations);
  }

  public async createWowInstallationForPath(applicationPath: string): Promise<WowInstallation> {
    const clientType = this._warcraftService.getClientTypeForBinary(applicationPath);
    const typeName = getEnumName(WowClientType, clientType);
    const currentInstallations = await this.getWowInstallationsByClientType(clientType);

    const label = currentInstallations.length == 0 ? null :
      await this.getNewInstallLabel(typeName, currentInstallations.length);

    const installation: WowInstallation = {
      id: uuidv4(),
      clientType: clientType,
      defaultAddonChannelType: AddonChannelType.Stable,
      defaultAutoUpdate: false,
      label: label,
      location: applicationPath,
      selected: false,
    };

    return installation;
  }

  public async importWowInstallations(blizzardAgentPath: string): Promise<void> {
    if (!blizzardAgentPath) {
      console.log(`Cannot import wow installations, no agent path`);
      const installations = await this.getWowInstallationsAsync();
      this._wowInstallationsSrc.next(installations);
      return;
    }

    const installedProducts = await this._warcraftService.getInstalledProducts(blizzardAgentPath);

    for (const product of Array.from(installedProducts.values())) {
      const typeName = getEnumName(WowClientType, product.clientType);
      const currentInstallations = await this.getWowInstallationsByClientType(product.clientType);

      const label = currentInstallations.length == 0 ? null :
        await this.getNewInstallLabel(typeName, currentInstallations.length);

      const fullProductPath = this.getFullProductPath(product.location, product.clientType);

      if (currentInstallations.some((inst) => inst.location === fullProductPath)) {
        continue;
      }

      const wowInstallation: WowInstallation = {
        id: uuidv4(),
        clientType: product.clientType,
        label,
        location: fullProductPath,
        selected: false,
        defaultAddonChannelType: AddonChannelType.Stable,
        defaultAutoUpdate: false,
      };

      try {
        await this.addInstallation(wowInstallation, false);
      } catch (e) {
        // Ignore duplicate error
      }
    }

    const wowInstallations = await this.getWowInstallationsAsync();
    this._wowInstallationsSrc.next(wowInstallations);
  }

  private async getNewInstallLabel(typeName: string, installCt: number): Promise<string> {
    let label = await this._translateService.get(`COMMON.CLIENT_TYPES.${typeName.toUpperCase()}`).toPromise();
    if (installCt > 0) {
      label += ` ${installCt + 1}`;
    }

    return label;
  }

  private async migrateAllLegacyInstallations(blizzardAgentPath: string): Promise<string> {
    if (!blizzardAgentPath) {
      console.info(`Unable to migrate legacy installations, no agent path`);
      return "";
    }

    const legacyInstallations: WowInstallation[] = [];
    for (const clientType of this._warcraftService.getAllClientTypes()) {
      try {
        const legacyInstallation = await this.migrateLegacyInstallations(clientType);
        if (legacyInstallation) {
          legacyInstallations.push(legacyInstallation);
        }
      } catch (e) {
        console.error(e);
      }
    }

    this._legacyInstallationSrc.next(legacyInstallations);

    return blizzardAgentPath;
  }

  /**
   * Migrate the old method of storing installation data into the new more flexible one
   * @deprecated
   */
  private async migrateLegacyInstallations(clientType: WowClientType): Promise<WowInstallation | undefined> {
    if ([WowClientType.None, WowClientType.ClassicBeta, WowClientType.ClassicEraPtr].includes(clientType)) {
      return undefined;
    }

    const typeName = getEnumName(WowClientType, clientType);

    const existingInstallations = await this.getWowInstallationsByClientType(clientType);
    if (existingInstallations.length > 0) {
      // console.debug(`Existing install exists for: ${typeName}`);
      return undefined;
    }

    const legacyLocationKey = this._warcraftService.getLegacyClientLocationKey(clientType);
    const legacyLocation = await this._preferenceStorageService.getAsync(legacyLocationKey);
    if (!legacyLocation) {
      // console.debug(`Legacy ${typeName}: nothing to migrate`);
      return undefined;
    }

    console.log(`Migrating legacy ${typeName} installation`);

    const legacyDefaultChannel = await this.getLegacyDefaultAddonChannel(typeName);
    const legacyDefaultAutoUpdate = await this.getLegacyDefaultAutoUpdate(typeName);

    const newLocation = this.getFullProductPath(legacyLocation, clientType);

    const newLocationExists = await this._fileService.pathExists(newLocation);
    if (!newLocationExists) {
      throw new Error(`Could not migrate legacy installation, path does not exist: ${newLocation}`);
    }

    const installation: WowInstallation = {
      id: uuidv4(),
      clientType,
      defaultAddonChannelType: legacyDefaultChannel,
      defaultAutoUpdate: legacyDefaultAutoUpdate,
      label: null,
      location: newLocation,
      selected: false,
    };

    await this.addInstallation(installation, false);

    return installation;
  }

  private getFullProductPath(location: string, clientType: WowClientType): string {
    const clientFolderName = this._warcraftService.getClientFolderName(clientType);
    const executableName = this._warcraftService.getExecutableName(clientType);
    return path.join(location, clientFolderName, executableName);
  }

  private async getLegacyDefaultAddonChannel(typeName: string): Promise<AddonChannelType> {
    const legacyDefaultChannelKey = `${typeName}${DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
    const pref = await this._preferenceStorageService.getAsync(legacyDefaultChannelKey);
    return parseInt(pref, 10) as AddonChannelType;
  }

  private async getLegacyDefaultAutoUpdate(typeName: string): Promise<boolean> {
    const legacyDefaultAutoUpdateKey = `${typeName}${DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
    const pref = await this._preferenceStorageService.getAsync(legacyDefaultAutoUpdateKey);
    return pref === "true";
  }
}
