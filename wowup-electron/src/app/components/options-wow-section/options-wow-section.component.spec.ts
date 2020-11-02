import { ComponentFixture, TestBed } from "@angular/core/testing";

import { OptionsWowSectionComponent } from "./options-wow-section.component";

describe("OptionsWowSectionComponent", () => {
  let component: OptionsWowSectionComponent;
  let fixture: ComponentFixture<OptionsWowSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OptionsWowSectionComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsWowSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
