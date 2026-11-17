/* eslint-disable @typescript-eslint/unbound-method */
import { AddonChannelType, AddonProvider, WowClientType, WowInstallation } from "wowup-lib-core";

import { ElectronService } from "../electron/electron.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { AddonBrokerService, ExportPayload } from "./addon-broker.service";
import { AddonService } from "./addon.service";
import { AddonProviderFactory } from "./addon.provider.factory";

describe("AddonBrokerService", () => {
  let addonService: jasmine.SpyObj<AddonService>;
  let addonProviderFactory: jasmine.SpyObj<AddonProviderFactory>;
  let service: AddonBrokerService;

  function createInstallation(clientType: WowClientType): WowInstallation {
    return {
      id: "install",
      clientType,
      location: "G:/WoW/Wow.exe",
      label: "install",
      displayName: "install",
      selected: true,
      defaultAddonChannelType: AddonChannelType.Stable,
      defaultAutoUpdate: false,
    };
  }

  function createPayload(clientType: string | undefined): ExportPayload {
    return {
      client_type: clientType,
      addons: [{ id: "123", name: "Details", provider_name: "WowUpHub" }],
    };
  }

  beforeEach(() => {
    addonService = jasmine.createSpyObj<AddonService>("AddonService", ["getAllAddons"]);
    addonService.getAllAddons.and.resolveTo([]);

    addonProviderFactory = jasmine.createSpyObj<AddonProviderFactory>("AddonProviderFactory", [
      "getEnabledAddonProviders",
    ]);
    addonProviderFactory.getEnabledAddonProviders.and.returnValue([{ name: "WowUpHub" } as AddonProvider]);

    service = new AddonBrokerService(
      {} as AddonStorageService,
      addonService,
      addonProviderFactory,
      {} as ElectronService,
    );
  });

  it("names both clients when the export is for a different client group", async () => {
    const summary = await service.getImportSummary(
      createPayload("Classic"),
      createInstallation(WowClientType.Anniversary),
    );

    expect(summary.errorCode).toBe("INVALID_CLIENT_TYPE");
    expect(summary.errorParams).toEqual({ importedClient: "Classic", targetClient: "Anniversary" });
    expect(addonService.getAllAddons).not.toHaveBeenCalled();
  });

  it("reports an export without a client type as unknown", async () => {
    const summary = await service.getImportSummary(
      createPayload(undefined),
      createInstallation(WowClientType.ClassicEra),
    );

    expect(summary.errorCode).toBe("INVALID_CLIENT_TYPE");
    expect(summary.errorParams).toEqual({ importedClient: "unknown", targetClient: "ClassicEra" });
  });

  it("accepts an export from another client in the same group", async () => {
    const summary = await service.getImportSummary(
      createPayload("ClassicPtr"),
      createInstallation(WowClientType.Classic),
    );

    expect(summary.errorCode).toBeUndefined();
    expect(summary.errorParams).toBeUndefined();
    expect(summary.addedCt).toBe(1);
  });
});
