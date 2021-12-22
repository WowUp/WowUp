import { BehaviorSubject, Observable } from "rxjs";

import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PipesModule } from "../../../modules/pipes.module";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { getStandardTestImports } from "../../../utils/test.utils";
import { ClientSelectorComponent } from "./client-selector.component";

describe("ClientSelectorComponent", () => {
  let component: ClientSelectorComponent;
  let fixture: ComponentFixture<ClientSelectorComponent>;

  let addonService;
  let sessionService;
  let warcraftInstallationService;

  beforeEach(async () => {
    addonService = jasmine.createSpyObj("AddonService", [""], {
      anyUpdatesAvailable$: new BehaviorSubject(false),
    });

    sessionService = jasmine.createSpyObj("SessionService", [""], {
      selectedWowInstallation$: new Observable(),
      enableControls$: new BehaviorSubject(true),
    });

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject([]),
    });

    await TestBed.configureTestingModule({
      declarations: [ClientSelectorComponent],
      imports: [...getStandardTestImports(), PipesModule],
    })
      .overrideComponent(ClientSelectorComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonService },
            { provide: SessionService, useValue: sessionService },
            { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          ],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClientSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
