import { DatePipe } from "@angular/common";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";
import { NgxDatePipe } from "../../../pipes/ngx-date.pipe";
import { RelativeDurationPipe } from "../../../pipes/relative-duration-pipe";
import { ElectronService } from "../../../services";
import { getStandardTestImports } from "../../../utils/test.utils";

import { DateTooltipCellComponent } from "./date-tooltip-cell.component";

describe("DateTooltipCellComponent", () => {
  let component: DateTooltipCellComponent;
  let fixture: ComponentFixture<DateTooltipCellComponent>;
  let electronService: any;

  beforeEach(async () => {
    electronService = jasmine.createSpyObj("ElectronService", [""], {
      windowFocused$: new Subject<boolean>(),
    });

    await TestBed.configureTestingModule({
      declarations: [DateTooltipCellComponent, RelativeDurationPipe, NgxDatePipe],
      imports: [...getStandardTestImports()],
      providers: [RelativeDurationPipe, NgxDatePipe, DatePipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(DateTooltipCellComponent, {
        set: {
          providers: [{ provide: ElectronService, useValue: electronService }],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DateTooltipCellComponent);
    component = fixture.componentInstance;

    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    component.agInit({
      value: new Date().getTime(),
    } as any);
    /* eslint-enable @typescript-eslint/no-unsafe-argument */

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
