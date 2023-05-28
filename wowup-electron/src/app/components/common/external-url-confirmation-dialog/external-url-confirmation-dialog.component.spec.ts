import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from "@angular/material/legacy-dialog";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { getStandardImports } from "../../../tests/test-helpers";

import { ExternalUrlConfirmationDialogComponent } from "./external-url-confirmation-dialog.component";

describe("ExternalUrlConfirmationDialogComponent", () => {
  let component: ExternalUrlConfirmationDialogComponent;
  let fixture: ComponentFixture<ExternalUrlConfirmationDialogComponent>;
  let wowUpService: any;

  beforeEach(async () => {
    wowUpService = jasmine.createSpyObj("WowUpService", [""], {
      getTrustedDomains() {
        return Promise.resolve([]);
      },
    });

    await TestBed.configureTestingModule({
      declarations: [ExternalUrlConfirmationDialogComponent],
      imports: [...getStandardImports()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            url: "https://wowup.io",
          },
        },
        {
          provide: MatDialogRef,
          useValue: {},
        },
      ],
    })
      .overrideComponent(ExternalUrlConfirmationDialogComponent, {
        set: {
          providers: [{ provide: WowUpService, useValue: wowUpService }],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExternalUrlConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
