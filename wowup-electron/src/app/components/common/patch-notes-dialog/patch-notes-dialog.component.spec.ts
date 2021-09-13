import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TrustHtmlPipe } from "../../../pipes/trust-html.pipe";
import { ElectronService } from "../../../services";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { LinkService } from "../../../services/links/link.service";
import { PatchNotesService } from "../../../services/wowup/patch-notes.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { getStandardImports } from "../../../tests/test-helpers";
import { PatchNotesDialogComponent } from "./patch-notes-dialog.component";

describe("PatchNotesDialogComponent", () => {
  let component: PatchNotesDialogComponent;
  let fixture: ComponentFixture<PatchNotesDialogComponent>;

  let electronService: ElectronService;
  let patchNotesService: PatchNotesService;
  let dialogFactory: DialogFactory;
  let wowupService: WowUpService;
  let linkService: any;

  beforeEach(async () => {
    electronService = jasmine.createSpyObj("ElectronService", {
      getVersionNumber: Promise.resolve("30.0.0"),
    });

    dialogFactory = jasmine.createSpyObj("DialogFactory", [""], {});
    wowupService = jasmine.createSpyObj("WowUpService", [""], {});
    linkService = jasmine.createSpyObj("LinkService", [""], {});

    patchNotesService = jasmine.createSpyObj("PatchNotesService", [""], {
      changeLogs: [
        {
          html: "",
        },
      ],
    });

    await TestBed.configureTestingModule({
      declarations: [PatchNotesDialogComponent, TrustHtmlPipe],
      imports: [...getStandardImports()],
    })
      .overrideComponent(PatchNotesDialogComponent, {
        set: {
          providers: [
            { provide: ElectronService, useValue: electronService },
            { provide: PatchNotesService, useValue: patchNotesService },
            { provide: DialogFactory, useValue: dialogFactory },
            { provide: WowUpService, useValue: wowupService },
            { provide: LinkService, useValue: linkService },
          ],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PatchNotesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
