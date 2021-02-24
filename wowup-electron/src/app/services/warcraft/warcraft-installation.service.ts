import * as _ from "lodash";
import { BehaviorSubject } from "rxjs";
import { filter, map, switchMap, tap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

import { Injectable } from "@angular/core";

import {
  DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
  WOW_INSTALLATIONS_KEY,
} from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftService } from "./warcraft.service";
import { AddonChannelType } from "../../../common/wowup/addon-channel-type";
import { getEnumName } from "app/utils/enum.utils";
import { TranslateService } from "@ngx-translate/core";
import { FileService } from "../files/file.service";
import { ElectronService } from "../electron/electron.service";

const CLIENT_RETAIL_FOLDER = "_retail_";
const CLIENT_RETAIL_PTR_FOLDER = "_ptr_";
const CLIENT_CLASSIC_FOLDER = "_classic_";
const CLIENT_CLASSIC_PTR_FOLDER = "_classic_ptr_";
const CLIENT_BETA_FOLDER = "_beta_";
const ADDON_FOLDER_NAME = "AddOns";
const INTERFACE_FOLDER_NAME = "Interface";

@Injectable({
  providedIn: "root",
})
export class WarcraftInstallationService {
  private readonly _wowInstallationsSrc = new BehaviorSubject<WowInstallation[]>([]);

  private _blizzardAgentPath = "";

  public readonly wowInstallations$ = this._wowInstallationsSrc.asObservable();

  public get blizzardAgentPath(): string {
    return `${this._blizzardAgentPath}`;
  }

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _warcraftService: WarcraftService,
    private _translateService: TranslateService,
    private _fileService: FileService,
    private _electronService: ElectronService
  ) {
    this._warcraftService.blizzardAgent$
      .pipe(
        filter((blizzardAgentPath) => !!blizzardAgentPath),
        tap((blizzardAgentPath) => {
          this._blizzardAgentPath = blizzardAgentPath;
        }),
        switchMap((blizzardAgentPath) => this.migrateAllLegacyInstallations(blizzardAgentPath)),
        map((blizzardAgentPath) => this.importWowInstallations(blizzardAgentPath))
      )
      .subscribe();
  }

  public getWowInstallations(): WowInstallation[] {
    return this._preferenceStorageService.getObject<WowInstallation[]>(WOW_INSTALLATIONS_KEY) || [];
  }

  public getWowInstallation(installationId: string): WowInstallation {
    return _.find(this._wowInstallationsSrc.value, (installation) => installation.id === installationId);
  }

  public getWowInstallationsByClientType(clientType: WowClientType): WowInstallation[] {
    return _.filter(this.getWowInstallations(), (installation) => installation.clientType === clientType);
  }

  public setWowInstallations(wowInstallations: WowInstallation[]): void {
    console.log(`Setting wow installations: ${wowInstallations.length}`);
    this._preferenceStorageService.setObject(WOW_INSTALLATIONS_KEY, wowInstallations);
  }

  public setSelectedWowInstallation(wowInstallation: WowInstallation): void {
    const allInstallations = this.getWowInstallations();
    _.forEach(allInstallations, (installation) => {
      installation.selected = installation.id === wowInstallation.id;
    });

    this.setWowInstallations(allInstallations);
  }

  public updateWowInstallation(wowInstallation: WowInstallation): void {
    const storedInstallations = this.getWowInstallations();
    const matchIndex = _.findIndex(
      this.getWowInstallations(),
      (installation) => installation.id === wowInstallation.id
    );

    if (matchIndex === -1) {
      throw new Error("No installation to update");
    }

    storedInstallations.splice(matchIndex, 1, wowInstallation);

    this.setWowInstallations(storedInstallations);
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

  public addInstallation(installation: WowInstallation): void {
    const existingInstallations = this.getWowInstallations();
    const exists = _.findIndex(existingInstallations, (inst) => inst.location === installation.location) !== -1;
    if (exists) {
      throw new Error(`Installation already exists: ${installation.location}`);
    }

    existingInstallations.push(installation);

    console.debug("ADDED INSTALL");
    this.setWowInstallations(existingInstallations);
    this._wowInstallationsSrc.next(existingInstallations);
  }

  public removeWowInstallation(installation: WowInstallation): void {
    const installations = this.getWowInstallations();
    const installationExists = _.findIndex(installations, (inst) => inst.id === installation.id) !== -1;
    if (!installationExists) {
      throw new Error(`Installation does not exist: ${installation.id}`);
    }

    _.remove(installations, (inst) => inst.id === installation.id);

    this.setWowInstallations(installations);
    this._wowInstallationsSrc.next(installations);
  }

  public async createWowInstallationForPath(applicationPath: string): Promise<WowInstallation> {
    const clientDir = path.dirname(applicationPath);
    const clientType = this._warcraftService.getClientTypeForFolderName(clientDir);
    const typeName = getEnumName(WowClientType, clientType);
    const currentInstallations = this.getWowInstallationsByClientType(clientType);

    const label = await this.getNewInstallLabel(typeName, currentInstallations.length);

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
    const installedProducts = await this._warcraftService.getInstalledProducts(blizzardAgentPath);

    for (const product of Array.from(installedProducts.values())) {
      const typeName = getEnumName(WowClientType, product.clientType);
      const currentInstallations = this.getWowInstallationsByClientType(product.clientType);

      const label = await this.getNewInstallLabel(typeName, currentInstallations.length);

      const fullProductPath = this.getFullProductPath(product.location, product.clientType);
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
        this.addInstallation(wowInstallation);
      } catch (e) {
        // Ignore duplicate error
      }
    }

    this._wowInstallationsSrc.next(this.getWowInstallations());
  }

  private async getNewInstallLabel(typeName: string, installCt: number): Promise<string> {
    let label = await this._translateService.get(`COMMON.CLIENT_TYPES.${typeName.toUpperCase()}`).toPromise();
    if (installCt > 0) {
      label += ` ${installCt + 1}`;
    }

    return label;
  }

  private async migrateAllLegacyInstallations(blizzardAgentPath: string): Promise<string> {
    for (const clientType of this._warcraftService.getAllClientTypes()) {
      try {
        await this.migrateLegacyInstallations(clientType);
      } catch (e) {
        console.error(e);
      }
    }

    return blizzardAgentPath;
  }

  private async migrateLegacyInstallations(clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    const typeName = getEnumName(WowClientType, clientType);

    const existingInstallations = this.getWowInstallationsByClientType(clientType);
    if (existingInstallations.length > 0) {
      console.debug(`Existing install exists for: ${typeName}`);
      return;
    }

    const legacyLocationKey = this._warcraftService.getLegacyClientLocationKey(clientType);
    const legacyLocation = this._preferenceStorageService.findByKey(legacyLocationKey);
    if (!legacyLocation) {
      console.debug(`Legacy ${typeName}: nothing to migrate`);
      return;
    }

    console.debug(`Migrating legacy ${typeName} installation`);

    const legacyDefaultChannel = this.getLegacyDefaultAddonChannel(typeName);
    const legacyDefaultAutoUpdate = this.getLegacyDefaultAutoUpdate(typeName);

    const label = await this._translateService.get(`COMMON.CLIENT_TYPES.${typeName.toUpperCase()}`).toPromise();

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
      label,
      location: newLocation,
      selected: false,
    };

    this.addInstallation(installation);
  }

  private getFullProductPath(location: string, clientType: WowClientType): string {
    const clientFolderName = this._warcraftService.getClientFolderName(clientType);
    const executableName = this._warcraftService.getExecutableName(clientType);
    return path.join(location, clientFolderName, executableName);
  }

  private getLegacyDefaultAddonChannel(typeName: string): AddonChannelType {
    const legacyDefaultChannelKey = `${typeName}${DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
    return parseInt(this._preferenceStorageService.findByKey(legacyDefaultChannelKey), 10) as AddonChannelType;
  }

  private getLegacyDefaultAutoUpdate(typeName: string): boolean {
    const legacyDefaultAutoUpdateKey = `${typeName}${DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
    return this._preferenceStorageService.findByKey(legacyDefaultAutoUpdateKey) === true.toString();
  }

  //   public getClientFolderName(clientType: WowClientType): string {
  //     switch (clientType) {
  //       case WowClientType.Retail:
  //         return CLIENT_RETAIL_FOLDER;
  //       case WowClientType.Classic:
  //         return CLIENT_CLASSIC_FOLDER;
  //       case WowClientType.RetailPtr:
  //         return CLIENT_RETAIL_PTR_FOLDER;
  //       case WowClientType.ClassicPtr:
  //         return CLIENT_CLASSIC_PTR_FOLDER;
  //       case WowClientType.Beta:
  //         return CLIENT_BETA_FOLDER;
  //       default:
  //         return "";
  //     }
  //   }
}
