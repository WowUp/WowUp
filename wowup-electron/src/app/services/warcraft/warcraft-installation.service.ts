import * as _ from "lodash";
import { BehaviorSubject } from "rxjs";
import { filter, map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

import { Injectable } from "@angular/core";

import { WOW_INSTALLATIONS_KEY } from "../../../common/constants";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftService } from "./warcraft.service";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";

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

  public readonly wowInstallations$ = this._wowInstallationsSrc.asObservable();

  constructor(private _preferenceStorageService: PreferenceStorageService, private _warcraftService: WarcraftService) {
    this._warcraftService.blizzardAgent$
      .pipe(
        filter((blizzardAgentPath) => !!blizzardAgentPath),
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

  public async importWowInstallations(blizzardAgentPath: string): Promise<void> {
    const wowInstallationPreferences = this.getWowInstallations();
    const installedProducts = await this._warcraftService.getInstalledProducts(blizzardAgentPath);

    const installations = _.map(Array.from(installedProducts.values()), (product) => {
      const wowInstallation: WowInstallation = {
        id: uuidv4(),
        clientType: product.clientType,
        label: product.name,
        location: product.location,
        selected: false,
        defaultAddonChannelType: AddonChannelType.Stable,
        defaultAutoUpdate: false,
      };
      return wowInstallation;
    });
    console.debug("db installations", installations);

    _.remove(
      installations,
      (installation) =>
        _.findIndex(wowInstallationPreferences, (pref) => pref.location === installation.location) !== -1
    );

    const allInstallations = [...wowInstallationPreferences, ...installations];

    if (allInstallations.length !== wowInstallationPreferences.length) {
      this.setWowInstallations(allInstallations);
    }

    console.debug("WOWINSTALLS", allInstallations);
    this._wowInstallationsSrc.next(allInstallations);
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
