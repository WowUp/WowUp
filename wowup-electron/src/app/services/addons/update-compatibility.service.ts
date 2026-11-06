import { firstValueFrom } from "rxjs";

import { Injectable } from "@angular/core";
import { Addon } from "wowup-lib-core";

import {
  GameVersionMismatchChoice,
  GameVersionMismatchDialogComponent,
  GameVersionMismatchDialogData,
  GameVersionMismatchGroup,
} from "../../components/addons/game-version-mismatch-dialog/game-version-mismatch-dialog.component";
import { AddonVersionMismatch } from "../../models/wowup/addon-version-mismatch";
import { getRequiredGameVersion } from "../../utils/addon.utils";
import { DialogFactory } from "../dialog/dialog.factory";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { AddonService } from "./addon.service";

/** Guards manual updates against addon releases made for a newer game version than the user has */
@Injectable({
  providedIn: "root",
})
export class UpdateCompatibilityService {
  public constructor(
    private _addonService: AddonService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _dialogFactory: DialogFactory,
  ) {}

  /**
   * Asks the user about the addons that need a newer game version than they run, and returns the
   * addons to go ahead with. Addons that are not at odds with their game version are never asked about.
   */
  public async confirmUpdates(addons: Addon[]): Promise<Addon[]> {
    const mismatches = await this._addonService.findGameVersionMismatches(addons, true);
    if (mismatches.length === 0) {
      return addons;
    }

    const dialogRef = this._dialogFactory.getDialog<GameVersionMismatchDialogComponent, GameVersionMismatchDialogData>(
      GameVersionMismatchDialogComponent,
      { data: { groups: this.toGroups(mismatches), canSkip: addons.length > mismatches.length } },
    );

    const choice: GameVersionMismatchChoice | undefined = await firstValueFrom(dialogRef.afterClosed());
    if (choice === "update") {
      return addons;
    }

    if (choice === "ignore") {
      await this.ignoreCurrentGameVersions(mismatches);
      return addons;
    }

    const held = mismatches.map((mismatch) => mismatch.addon);
    return addons.filter((addon) => !held.includes(addon));
  }

  /** Stops the warnings for as long as the installations stay on the game version they run now */
  private async ignoreCurrentGameVersions(mismatches: AddonVersionMismatch[]): Promise<void> {
    const installations = new Map(mismatches.map((mismatch) => [mismatch.installation.id, mismatch.installation]));
    for (const installation of installations.values()) {
      await this._warcraftInstallationService.updateWowInstallation({
        ...installation,
        ignoredCompatibilityVersion: installation.gameVersion,
      });
    }
  }

  private toGroups(mismatches: AddonVersionMismatch[]): GameVersionMismatchGroup[] {
    const groups = new Map<string, GameVersionMismatchGroup>();
    for (const { addon, installation } of mismatches) {
      let group = groups.get(installation.id);
      if (!group) {
        group = {
          installationName: installation.displayName,
          gameVersion: installation.gameVersion ?? "",
          addons: [],
        };
        groups.set(installation.id, group);
      }

      group.addons.push({
        name: addon.name,
        requiredVersion: getRequiredGameVersion(addon.gameVersion, installation.gameVersion) ?? "",
      });
    }

    return Array.from(groups.values());
  }
}
