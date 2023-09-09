import * as _ from "lodash";
import * as path from "path";
import { firstValueFrom, from, ReplaySubject, Subject } from "rxjs";
import { map, tap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { WOW_INSTALLATIONS_KEY } from "../../../common/constants";
import { getWowClientFolderName, getWowClientGroup } from "../../../common/warcraft";
import { getEnumName } from "wowup-lib-core";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftService } from "./warcraft.service";
import { AddonChannelType, WowClientGroup, WowClientType } from "wowup-lib-core";
import { WowInstallation } from "wowup-lib-core";

const DEFAULT_NAME_TOKEN = "{defaultName}";

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
      for (const installation of installations) {
        // Saved display names can be unreliable (e.g. language change,
        // expansion release). Always regenerate them.
        const typeName = getEnumName(WowClientType, installation.clientType);
        this.getDisplayName(installation.label, typeName)
          .then((displayName) => (installation.displayName = displayName))
          .catch(() => {});
      }
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

  public async getWowInstallationsByClientGroups(clientGroups: WowClientGroup[]): Promise<WowInstallation[]> {
    const installations = await this.getWowInstallationsAsync();
    return _.filter(installations, (installation) => {
      const clientGroup = getWowClientGroup(installation.clientType);
      return clientGroups.includes(clientGroup);
    });
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

  public async getInstallationDisplayName(wowInstallation: WowInstallation): Promise<string> {
    const typeName = getEnumName(WowClientType, wowInstallation.clientType);
    return await this.getDisplayName(wowInstallation.label, typeName);
  }

  public async updateWowInstallation(wowInstallation: WowInstallation): Promise<void> {
    const typeName = getEnumName(WowClientType, wowInstallation.clientType);
    wowInstallation.displayName = await this.getDisplayName(wowInstallation.label, typeName);

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

    const label = currentInstallations.length
      ? `${DEFAULT_NAME_TOKEN} ${currentInstallations.length + 1}`
      : DEFAULT_NAME_TOKEN;

    const displayName = await this.getDisplayName(label, typeName);

    const installation: WowInstallation = {
      id: uuidv4(),
      clientType: clientType,
      defaultAddonChannelType: AddonChannelType.Stable,
      defaultAutoUpdate: false,
      label: label,
      displayName: displayName,
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

      const label = currentInstallations.length ? `${DEFAULT_NAME_TOKEN} ${currentInstallations.length + 1}` : DEFAULT_NAME_TOKEN;
      const displayName = await this.getDisplayName(label, typeName);

      const fullProductPath = this.getFullProductPath(product.location, product.clientType);

      if (currentInstallations.some((inst) => inst.location === fullProductPath)) {
        continue;
      }

      const wowInstallation: WowInstallation = {
        id: uuidv4(),
        clientType: product.clientType,
        label,
        displayName,
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

  private async getDisplayName(label: string, typeName: string): Promise<string> {
    const defaultName: string = await firstValueFrom(
      this._translateService.get(`COMMON.CLIENT_TYPES.${typeName.toUpperCase()}`)
    );
    return label.replace(DEFAULT_NAME_TOKEN, defaultName);
  }

  private getFullProductPath(location: string, clientType: WowClientType): string {
    const clientFolderName = getWowClientFolderName(clientType);
    const executableName = this._warcraftService.getExecutableName(clientType);
    return path.join(location, clientFolderName, executableName);
  }
}
