import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule, TranslateService } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { AddonInstallState } from "../../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService, DependencyInstallEvent, DependencyInstallState } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { ProgressButtonComponent } from "../../common/progress-button/progress-button.component";
import { AddonInstallButtonComponent } from "./addon-install-button.component";
import { Addon, AddonSearchResult, WowClientType } from "wowup-lib-core";

describe("AddonInstallButtonComponent", () => {
  let addonServiceSpy: any;
  let sessionServiceSpy: any;
  let addonInstalledSrc: Subject<AddonUpdateEvent>;
  let dependencyInstallSrc: Subject<DependencyInstallEvent>;

  beforeEach(async () => {
    addonInstalledSrc = new Subject<AddonUpdateEvent>();
    dependencyInstallSrc = new Subject<DependencyInstallEvent>();
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      {
        isInstalled: Promise.resolve(false),
        getDependencyInstallStatuses: [],
      },
      {
        addonInstalled$: addonInstalledSrc.asObservable(),
        dependencyInstall$: dependencyInstallSrc.asObservable(),
      },
    );
    sessionServiceSpy = jasmine.createSpyObj(
      "SessionService",
      ["getSelectedClientType", "getSelectedWowInstallation"],
      {
        selectedClientType: WowClientType.Retail,
      },
    );

    await TestBed.configureTestingModule({
      declarations: [AddonInstallButtonComponent, ProgressButtonComponent],
      imports: [
        HttpClientModule,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useFactory: httpLoaderFactory,
            deps: [HttpClient],
          },
          compiler: {
            provide: TranslateCompiler,
            useClass: TranslateMessageFormatCompiler,
          },
        }),
      ],
    })
      .overrideComponent(AddonInstallButtonComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
          ],
        },
      })
      .compileComponents();

    sessionServiceSpy.getSelectedWowInstallation.and.returnValue({ id: "install-1" });
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AddonInstallButtonComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe("dependency progress", () => {
    const parent = {
      id: "addon-1",
      externalId: "1001",
      providerName: "Curse",
      installationId: "install-1",
    } as Addon;

    function dependencyEvent(overrides: Partial<DependencyInstallEvent> = {}): DependencyInstallEvent {
      return { addon: parent, state: DependencyInstallState.Resolving, total: 2, completed: 0, ...overrides };
    }

    function createButton() {
      const translate = TestBed.inject(TranslateService);
      spyOn(translate, "instant").and.callFake((key: string | string[], params?: object) =>
        params ? `${key as string} ${JSON.stringify(params)}` : key,
      );

      const fixture = TestBed.createComponent(AddonInstallButtonComponent);
      fixture.componentInstance.addonSearchResult = {
        externalId: "1001",
        providerName: "Curse",
        externallyBlocked: false,
      } as AddonSearchResult;
      return fixture.componentInstance;
    }

    it("should stay busy with the dependencies once the addon itself completes", () => {
      const button = createButton();
      addonServiceSpy.getDependencyInstallStatuses.and.returnValue([dependencyEvent()]);

      addonInstalledSrc.next({ addon: parent, installState: AddonInstallState.Complete, progress: 100 });

      expect(button.buttonText$.value).toEqual("COMMON.ADDON_STATUS.CHECKING_DEPENDENCIES");
      expect(button.showProgress$.value).toBeTrue();
      expect(button.disableButton$.value).toBeTrue();
    });

    it("should count the dependencies up as they finish", () => {
      const button = createButton();

      dependencyInstallSrc.next(dependencyEvent({ state: DependencyInstallState.Installing, completed: 1 }));

      expect(button.buttonText$.value).toEqual('COMMON.ADDON_STATUS.INSTALLING_DEPENDENCIES {"completed":1,"total":2}');
      expect(button.progressValue$.value).toEqual(50);
    });

    it("should show installed once the dependencies are done", () => {
      const button = createButton();
      dependencyInstallSrc.next(dependencyEvent({ state: DependencyInstallState.Installing, completed: 1 }));

      dependencyInstallSrc.next(dependencyEvent({ state: DependencyInstallState.Complete, completed: 2 }));

      expect(button.buttonText$.value).toEqual("COMMON.ADDON_STATUS.COMPLETE");
      expect(button.showProgress$.value).toBeFalse();
      expect(button.disableButton$.value).toBeTrue();
    });

    it("should not show installed when an addon that failed drops its dependencies", () => {
      const button = createButton();
      addonInstalledSrc.next({ addon: parent, installState: AddonInstallState.Error, progress: 100 });
      const textAfterError = button.buttonText$.value;

      dependencyInstallSrc.next(dependencyEvent({ state: DependencyInstallState.Complete, total: 0 }));

      expect(button.buttonText$.value).toEqual(textAfterError);
    });

    it("should show installed when the addon has no dependencies to install", () => {
      const button = createButton();

      addonInstalledSrc.next({ addon: parent, installState: AddonInstallState.Complete, progress: 100 });

      expect(button.buttonText$.value).toEqual("COMMON.ADDON_STATUS.COMPLETE");
    });

    it("should ignore the dependencies of other addons", () => {
      const button = createButton();
      const other = { ...parent, id: "addon-2", externalId: "2002" };

      dependencyInstallSrc.next(dependencyEvent({ addon: other }));

      expect(button.showProgress$.value).toBeFalse();
    });

    it("should pick up dependency progress when created part way through", async () => {
      const button = createButton();
      addonServiceSpy.getDependencyInstallStatuses.and.returnValue([
        dependencyEvent({ state: DependencyInstallState.Installing, completed: 1 }),
      ]);

      button.ngOnInit();
      await new Promise((r) => setTimeout(r));

      expect(button.buttonText$.value).toEqual('COMMON.ADDON_STATUS.INSTALLING_DEPENDENCIES {"completed":1,"total":2}');
    });
  });
});
