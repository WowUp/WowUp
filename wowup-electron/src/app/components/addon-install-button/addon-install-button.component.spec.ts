import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AddonInstallButtonComponent } from "./addon-install-button.component";

describe("AddonInstallButtonComponent", () => {
  let component: AddonInstallButtonComponent;
  let fixture: ComponentFixture<AddonInstallButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddonInstallButtonComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonInstallButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
