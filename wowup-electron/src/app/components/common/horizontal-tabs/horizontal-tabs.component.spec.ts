import { BehaviorSubject, Subject } from "rxjs";

import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ElectronService } from "../../../services";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { getStandardImports, mockPreload } from "../../../tests/test-helpers";
import { HorizontalTabsComponent } from "./horizontal-tabs.component";

describe("HorizontalTabsComponent", () => {
  let component: HorizontalTabsComponent;
  let fixture: ComponentFixture<HorizontalTabsComponent>;
  let sessionService: SessionService;
  let electronService: any;
  let warcraftInstallationService: WarcraftInstallationService;

  beforeEach(async () => {
    mockPreload();

    sessionService = jasmine.createSpyObj("SessionService", ["getSelectedClientType", "getSelectedDetailsTab"], {
      getSelectedWowInstallation: () => "description",
      selectedHomeTab$: new BehaviorSubject(1),
      wowUpAccount$: new Subject(),
    });

    electronService = jasmine.createSpyObj("ElectronService", [""], {});

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject([]),
    });

    let testBed = TestBed.configureTestingModule({
      declarations: [HorizontalTabsComponent],
      imports: [...getStandardImports()],
    });

    testBed = testBed.overrideComponent(HorizontalTabsComponent, {
      set: {
        providers: [
          { provide: ElectronService, useValue: electronService },
          { provide: SessionService, useValue: sessionService },
          { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
        ],
      },
    });

    await testBed.compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HorizontalTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
