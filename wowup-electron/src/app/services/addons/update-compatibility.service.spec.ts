/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { of } from "rxjs";

import { MatDialogRef } from "@angular/material/dialog";
import { Addon, AddonChannelType, WowClientType, WowInstallation } from "wowup-lib-core";

import {
  GameVersionMismatchChoice,
  GameVersionMismatchDialogComponent,
  GameVersionMismatchDialogData,
} from "../../components/addons/game-version-mismatch-dialog/game-version-mismatch-dialog.component";
import { AddonVersionMismatch } from "../../models/wowup/addon-version-mismatch";
import { DialogFactory } from "../dialog/dialog.factory";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { AddonService } from "./addon.service";
import { UpdateCompatibilityService } from "./update-compatibility.service";

describe("UpdateCompatibilityService", () => {
  let addonService: jasmine.SpyObj<AddonService>;
  let installationService: jasmine.SpyObj<WarcraftInstallationService>;
  let dialogFactory: jasmine.SpyObj<DialogFactory>;
  let service: UpdateCompatibilityService;

  let retail: WowInstallation;
  let classic: WowInstallation;
  let dialogData: GameVersionMismatchDialogData | undefined;

  function createInstallation(id: string, clientType: WowClientType, gameVersion: string): WowInstallation {
    return {
      id,
      clientType,
      location: `G:/WoW/${id}/Wow.exe`,
      label: id,
      displayName: `Display ${id}`,
      selected: false,
      defaultAddonChannelType: AddonChannelType.Stable,
      defaultAutoUpdate: false,
      gameVersion,
    };
  }

  function createAddon(id: string, installation: WowInstallation, gameVersion: string[]): Addon {
    return { id, name: `Addon ${id}`, installationId: installation.id, gameVersion } as Addon;
  }

  function mismatchesOf(...pairs: [Addon, WowInstallation][]): AddonVersionMismatch[] {
    return pairs.map(([addon, installation]) => ({ addon, installation }));
  }

  /** Makes the dialog close with the choice, undefined for a dismissal */
  function userChooses(choice: GameVersionMismatchChoice | undefined): void {
    dialogFactory.getDialog.and.callFake(((_component: unknown, config: { data: GameVersionMismatchDialogData }) => {
      dialogData = config.data;
      return { afterClosed: () => of(choice) } as MatDialogRef<GameVersionMismatchDialogComponent>;
    }) as any);
  }

  beforeEach(() => {
    retail = createInstallation("retail", WowClientType.Retail, "12.1.5");
    classic = createInstallation("era", WowClientType.ClassicEra, "1.15.9");
    dialogData = undefined;

    addonService = jasmine.createSpyObj<AddonService>("AddonService", ["findGameVersionMismatches"]);
    addonService.findGameVersionMismatches.and.resolveTo([]);

    installationService = jasmine.createSpyObj<WarcraftInstallationService>("WarcraftInstallationService", [
      "updateWowInstallation",
    ]);
    installationService.updateWowInstallation.and.resolveTo();

    dialogFactory = jasmine.createSpyObj<DialogFactory>("DialogFactory", ["getDialog"]);

    service = new UpdateCompatibilityService(addonService, installationService, dialogFactory);
  });

  it("returns the addons untouched without asking when none needs a newer game version", async () => {
    const addons = [createAddon("a", retail, ["12.1.5"])];

    expect(await service.confirmUpdates(addons)).toEqual(addons);
    expect(dialogFactory.getDialog).not.toHaveBeenCalled();
  });

  it("re-reads the installed game versions before deciding", async () => {
    const addons = [createAddon("a", retail, ["12.1.5"])];

    await service.confirmUpdates(addons);

    expect(addonService.findGameVersionMismatches).toHaveBeenCalledWith(addons, true);
  });

  describe("with an addon that needs a newer game version", () => {
    let tooNew: Addon;
    let fine: Addon;

    beforeEach(() => {
      tooNew = createAddon("too-new", retail, ["12.1.7"]);
      fine = createAddon("fine", retail, ["12.1.5"]);
      addonService.findGameVersionMismatches.and.resolveTo(mismatchesOf([tooNew, retail]));
    });

    it("updates everything when the user chooses to update anyway", async () => {
      userChooses("update");

      expect(await service.confirmUpdates([tooNew, fine])).toEqual([tooNew, fine]);
      expect(installationService.updateWowInstallation).not.toHaveBeenCalled();
    });

    it("remembers the current game version when the user chooses to ignore it", async () => {
      userChooses("ignore");

      expect(await service.confirmUpdates([tooNew, fine])).toEqual([tooNew, fine]);
      expect(installationService.updateWowInstallation).toHaveBeenCalledOnceWith({
        ...retail,
        ignoredCompatibilityVersion: "12.1.5",
      });
    });

    it("remembers each installation once, however many of its addons are held", async () => {
      const alsoTooNew = createAddon("also-too-new", retail, ["12.2.0"]);
      addonService.findGameVersionMismatches.and.resolveTo(mismatchesOf([tooNew, retail], [alsoTooNew, retail]));
      userChooses("ignore");

      await service.confirmUpdates([tooNew, alsoTooNew]);

      expect(installationService.updateWowInstallation).toHaveBeenCalledTimes(1);
    });

    it("remembers every installation that has a held addon", async () => {
      const eraTooNew = createAddon("era-too-new", classic, ["1.15.10"]);
      addonService.findGameVersionMismatches.and.resolveTo(mismatchesOf([tooNew, retail], [eraTooNew, classic]));
      userChooses("ignore");

      await service.confirmUpdates([tooNew, eraTooNew]);

      expect(
        installationService.updateWowInstallation.calls.allArgs().map(([inst]) => inst.ignoredCompatibilityVersion),
      ).toEqual(["12.1.5", "1.15.9"]);
    });

    it("leaves out only the held addons when the user skips them", async () => {
      userChooses("skip");

      expect(await service.confirmUpdates([tooNew, fine])).toEqual([fine]);
      expect(installationService.updateWowInstallation).not.toHaveBeenCalled();
    });

    it("treats closing the dialog as skipping", async () => {
      userChooses(undefined);

      expect(await service.confirmUpdates([tooNew, fine])).toEqual([fine]);
    });

    it("offers to skip only when there is something else to update", async () => {
      userChooses("skip");

      await service.confirmUpdates([tooNew, fine]);
      expect(dialogData?.canSkip).toBeTrue();

      expect(await service.confirmUpdates([tooNew])).toEqual([]);
      expect(dialogData?.canSkip).toBeFalse();
    });

    it("tells the user which version each addon needs, grouped by installation", async () => {
      const eraTooNew = createAddon("era-too-new", classic, ["12.1.7", "1.15.10", "1.15.12"]);
      addonService.findGameVersionMismatches.and.resolveTo(mismatchesOf([tooNew, retail], [eraTooNew, classic]));
      userChooses("skip");

      await service.confirmUpdates([tooNew, eraTooNew]);

      expect(dialogData?.groups).toEqual([
        {
          installationName: "Display retail",
          gameVersion: "12.1.5",
          addons: [{ name: "Addon too-new", requiredVersion: "12.1.7" }],
        },
        {
          installationName: "Display era",
          gameVersion: "1.15.9",
          addons: [{ name: "Addon era-too-new", requiredVersion: "1.15.10" }],
        },
      ]);
    });
  });
});
