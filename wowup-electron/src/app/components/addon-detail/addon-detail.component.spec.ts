import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AddonDetailComponent } from "./addon-detail.component";

describe("AddonDetailComponent", () => {
  let component: AddonDetailComponent;
  let fixture: ComponentFixture<AddonDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddonDetailComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
