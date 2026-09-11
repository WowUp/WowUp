import { BehaviorSubject, of, Subject } from "rxjs";

import {
  CURRENT_THEME_KEY,
  DARK_THEME_KEY,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
  LIGHT_THEME_KEY,
  THEME_SYNC_ENABLED_KEY,
} from "../../../common/constants";
import { PreferenceChange } from "../../models/wowup/preference-change";
import { AddonService } from "../addons/addon.service";
import { AddonProviderFactory } from "../addons/addon.provider.factory";
import { ThemeApiService } from "../api/theme-api.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WowUpAccountService } from "../wowup/wowup-account.service";
import { WowUpService } from "../wowup/wowup.service";
import { SessionService } from "./session.service";

interface ThemeOverrides {
  themeSyncEnabled?: boolean;
  lightTheme?: string;
  darkTheme?: string;
  currentTheme?: string;
  shouldUseDarkColors?: boolean;
}

describe("SessionService", () => {
  let service: SessionService;
  let preferenceChangeSrc: Subject<PreferenceChange>;
  let onShouldUseDarkColorsChangedCallback: (shouldUseDarkColors: boolean) => void;

  function createService(overrides: ThemeOverrides = {}) {
    preferenceChangeSrc = new Subject<PreferenceChange>();

    const warcraftInstallationServiceSpy = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: of([]),
    });

    const preferenceStorageServiceSpy = jasmine.createSpyObj("PreferenceStorageService", ["getObjectAsync"]);
    preferenceStorageServiceSpy.getObjectAsync.and.returnValue(Promise.resolve(undefined));

    const wowUpAccountServiceSpy = jasmine.createSpyObj("WowUpAccountService", [""], {
      wowUpAuthTokenSrc: new BehaviorSubject(""),
      wowUpAccountSrc: new BehaviorSubject(undefined),
      accountPushSrc: new BehaviorSubject(false),
    });

    const wowUpServiceSpy = jasmine.createSpyObj(
      "WowUpService",
      ["getCurrentTheme", "getThemeSyncEnabled", "getLightTheme", "getDarkTheme"],
      { preferenceChange$: preferenceChangeSrc.asObservable() },
    );
    wowUpServiceSpy.getCurrentTheme.and.returnValue(Promise.resolve(overrides.currentTheme ?? DEFAULT_THEME));
    wowUpServiceSpy.getThemeSyncEnabled.and.returnValue(Promise.resolve(overrides.themeSyncEnabled ?? false));
    wowUpServiceSpy.getLightTheme.and.returnValue(Promise.resolve(overrides.lightTheme ?? DEFAULT_LIGHT_THEME));
    wowUpServiceSpy.getDarkTheme.and.returnValue(Promise.resolve(overrides.darkTheme ?? DEFAULT_THEME));

    const themeApiServiceSpy = jasmine.createSpyObj("ThemeApiService", [
      "getShouldUseDarkColors",
      "onShouldUseDarkColorsChanged",
    ]);
    themeApiServiceSpy.getShouldUseDarkColors.and.returnValue(Promise.resolve(overrides.shouldUseDarkColors ?? true));
    themeApiServiceSpy.onShouldUseDarkColorsChanged.and.callFake((callback: (shouldUseDarkColors: boolean) => void) => {
      onShouldUseDarkColorsChangedCallback = callback;
    });

    const addonServiceSpy = jasmine.createSpyObj("AddonService", [""], { syncing$: of(false) });

    const addonProviderServiceSpy = jasmine.createSpyObj("AddonProviderFactory", ["getEnabledAddonProviders"], {
      addonProviderChange$: new Subject(),
    });
    addonProviderServiceSpy.getEnabledAddonProviders.and.returnValue([]);

    service = new SessionService(
      warcraftInstallationServiceSpy as unknown as WarcraftInstallationService,
      preferenceStorageServiceSpy as unknown as PreferenceStorageService,
      wowUpAccountServiceSpy as unknown as WowUpAccountService,
      wowUpServiceSpy as unknown as WowUpService,
      themeApiServiceSpy as unknown as ThemeApiService,
      addonServiceSpy as unknown as AddonService,
      addonProviderServiceSpy as unknown as AddonProviderFactory,
    );

    return { wowUpServiceSpy, themeApiServiceSpy };
  }

  async function flush() {
    // let every getXyz() promise chain in the SessionService constructor resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it("should be created", () => {
    createService();
    expect(service).toBeTruthy();
  });

  it("uses the manually selected theme when sync is disabled", async () => {
    createService({ themeSyncEnabled: false, currentTheme: HORDE_THEME });
    await flush();

    expect(service.currentTheme).toBe(HORDE_THEME);
  });

  it("uses the dark theme pick when sync is enabled and the OS is dark", async () => {
    createService({
      themeSyncEnabled: true,
      darkTheme: HORDE_THEME,
      lightTheme: HORDE_LIGHT_THEME,
      shouldUseDarkColors: true,
    });
    await flush();

    expect(service.currentTheme).toBe(HORDE_THEME);
  });

  it("uses the light theme pick when sync is enabled and the OS is light", async () => {
    createService({
      themeSyncEnabled: true,
      darkTheme: HORDE_THEME,
      lightTheme: HORDE_LIGHT_THEME,
      shouldUseDarkColors: false,
    });
    await flush();

    expect(service.currentTheme).toBe(HORDE_LIGHT_THEME);
  });

  it("switches the effective theme live when the OS appearance changes, with no restart", async () => {
    createService({
      themeSyncEnabled: true,
      darkTheme: HORDE_THEME,
      lightTheme: HORDE_LIGHT_THEME,
      shouldUseDarkColors: true,
    });
    await flush();
    expect(service.currentTheme).toBe(HORDE_THEME);

    onShouldUseDarkColorsChangedCallback(false);
    expect(service.currentTheme).toBe(HORDE_LIGHT_THEME);

    onShouldUseDarkColorsChangedCallback(true);
    expect(service.currentTheme).toBe(HORDE_THEME);
  });

  it("reacts to theme preference changes pushed from elsewhere in the app", async () => {
    createService({ themeSyncEnabled: false, currentTheme: DEFAULT_THEME, shouldUseDarkColors: true });
    await flush();
    expect(service.currentTheme).toBe(DEFAULT_THEME);

    preferenceChangeSrc.next({ key: DARK_THEME_KEY, value: HORDE_THEME });
    preferenceChangeSrc.next({ key: LIGHT_THEME_KEY, value: HORDE_LIGHT_THEME });
    preferenceChangeSrc.next({ key: THEME_SYNC_ENABLED_KEY, value: "true" });

    expect(service.currentTheme).toBe(HORDE_THEME);

    preferenceChangeSrc.next({ key: THEME_SYNC_ENABLED_KEY, value: "false" });
    preferenceChangeSrc.next({ key: CURRENT_THEME_KEY, value: DEFAULT_THEME });

    expect(service.currentTheme).toBe(DEFAULT_THEME);
  });
});
