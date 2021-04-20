import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TrustHtmlPipe } from "../../pipes/trust-html.pipe";
import { ElectronService } from "../../services";
import { PatchNotesService } from "../../services/wowup/patch-notes.service";
import { getStandardImports } from "../../tests/test-helpers";
import { PatchNotesDialogComponent } from "./patch-notes-dialog.component";

describe("PatchNotesDialogComponent", () => {
  let component: PatchNotesDialogComponent;
  let fixture: ComponentFixture<PatchNotesDialogComponent>;

  let electronService: ElectronService;
  let patchNotesService: PatchNotesService;

  beforeEach(async () => {
    electronService = jasmine.createSpyObj("ElectronService", {
      getVersionNumber: Promise.resolve("30.0.0"),
    });

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
