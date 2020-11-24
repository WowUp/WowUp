import { ComponentFixture, TestBed } from "@angular/core/testing";

import { OptionsAppSectionComponent } from "./options-app-section.component";

describe("OptionsAppSectionComponent", () => {
  let component: OptionsAppSectionComponent;
  let fixture: ComponentFixture<OptionsAppSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OptionsAppSectionComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsAppSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
