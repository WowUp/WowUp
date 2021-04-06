import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { getStandardTestImports } from "../../utils/test.utils";

import { DateTooltipCellComponent } from "./date-tooltip-cell.component";

describe("DateTooltipCellComponent", () => {
  let component: DateTooltipCellComponent;
  let fixture: ComponentFixture<DateTooltipCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DateTooltipCellComponent, RelativeDurationPipe],
      imports: [...getStandardTestImports()],
      providers: [RelativeDurationPipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DateTooltipCellComponent);
    component = fixture.componentInstance;

    component.agInit({
      value: new Date().getTime(),
    } as any);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
