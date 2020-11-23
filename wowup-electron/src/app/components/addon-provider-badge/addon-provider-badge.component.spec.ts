import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AddonProviderBadgeComponent } from "./addon-provider-badge.component";

describe("AddonProviderBadgeComponent", () => {
  let component: AddonProviderBadgeComponent;
  let fixture: ComponentFixture<AddonProviderBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddonProviderBadgeComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonProviderBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
