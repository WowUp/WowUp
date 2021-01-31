import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_SNACK_BAR_DATA } from "@angular/material/snack-bar";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatModule } from "../../mat-module";

import { CenteredSnackbarComponent, CenteredSnackbarComponentData } from "./centered-snackbar.component";

describe("CenteredSnackbarComponent", () => {
  let component: CenteredSnackbarComponent;
  let fixture: ComponentFixture<CenteredSnackbarComponent>;
  let dialogData: CenteredSnackbarComponentData;

  beforeEach(async () => {
    dialogData = {
      message: "TEST MESSAGE",
    };

    await TestBed.configureTestingModule({
      declarations: [CenteredSnackbarComponent],
      imports: [MatModule, NoopAnimationsModule],
      providers: [{ provide: MAT_SNACK_BAR_DATA, useValue: dialogData }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CenteredSnackbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
