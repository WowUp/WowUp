import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable } from "rxjs";
import { SessionService } from "../../services/session/session.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { getStandardImports, mockPreload } from "../../tests/test-helpers";

import { VerticalTabsComponent } from "./vertical-tabs.component";

describe("VerticalTabsComponent", () => {
  let component: VerticalTabsComponent;
  let fixture: ComponentFixture<VerticalTabsComponent>;
  let sessionService: SessionService;
  let warcraftInstallationService: WarcraftInstallationService;

  beforeEach(async () => {
    mockPreload();

    sessionService = jasmine.createSpyObj("SessionService", ["getSelectedClientType", "getSelectedDetailsTab"], {
      getSelectedWowInstallation: () => "description",
      selectedHomeTab$: new BehaviorSubject(1),
    });

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject([]),
    });

    let testBed = TestBed.configureTestingModule({
      declarations: [VerticalTabsComponent],
      imports: [...getStandardImports()],
    });

    testBed = testBed.overrideComponent(VerticalTabsComponent, {
      set: {
        providers: [
          { provide: SessionService, useValue: sessionService },
          { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
        ],
      },
    });

    await testBed.compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VerticalTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
