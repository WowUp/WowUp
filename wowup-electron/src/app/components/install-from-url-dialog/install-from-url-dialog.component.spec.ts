import { ComponentFixture, TestBed } from "@angular/core/testing";
import { InstallFromUrlDialogComponent } from "./install-from-url-dialog.component";

describe("InstallFromUrlDialogComponent", () => {
  let component: InstallFromUrlDialogComponent;
  let fixture: ComponentFixture<InstallFromUrlDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InstallFromUrlDialogComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InstallFromUrlDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
