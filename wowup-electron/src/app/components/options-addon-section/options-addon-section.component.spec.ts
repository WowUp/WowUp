import { ComponentFixture, TestBed } from "@angular/core/testing";

import { OptionsAddonSectionComponent } from "./options-addon-section.component";

describe("OptionsAddonSectionComponent", () => {
  let component: OptionsAddonSectionComponent;
  let fixture: ComponentFixture<OptionsAddonSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OptionsAddonSectionComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsAddonSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
