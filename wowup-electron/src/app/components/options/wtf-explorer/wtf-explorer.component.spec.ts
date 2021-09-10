import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ElectronService } from "../../../services";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { WarcraftService } from "../../../services/warcraft/warcraft.service";
import { WtfService } from "../../../services/wtf/wtf.service";
import { getStandardImports } from "../../../tests/test-helpers";

import { WtfExplorerComponent } from "./wtf-explorer.component";

describe("WtfExplorerComponent", () => {
  let component: WtfExplorerComponent;
  let fixture: ComponentFixture<WtfExplorerComponent>;
  let electronService: ElectronService;
  let warcraftService: WarcraftService;
  let warcraftInstallationService: WarcraftInstallationService;
  let wtfService: WtfService;

  beforeEach(async () => {
    electronService = jasmine.createSpyObj("ElectronService", [""], {});
    warcraftService = jasmine.createSpyObj("WarcraftService", [""], {});
    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {});
    wtfService = jasmine.createSpyObj("WtfService", [""], {});

    await TestBed.configureTestingModule({
      declarations: [WtfExplorerComponent],
      imports: [getStandardImports()],
    })
      .overrideComponent(WtfExplorerComponent, {
        set: {
          providers: [
            { provide: ElectronService, useValue: electronService },
            { provide: WarcraftService, useValue: warcraftService },
            { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
            { provide: WtfService, useValue: wtfService },
          ],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WtfExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
