import { Component, Input } from "@angular/core";
import { TestBedStatic } from "@angular/core/testing";
import { MatIcon, MatIconModule } from "@angular/material/icon";

@Component({
  selector: "mat-icon",
  template: "<span></span>",
})
export class MockMatIconComponent {
  @Input() svgIcon: any;
  @Input() fontSet: any;
  @Input() fontIcon: any;
}

export function overrideIconModule(testBed: TestBedStatic): TestBedStatic {
  return testBed.overrideModule(MatIconModule, {
    remove: {
      declarations: [MatIcon],
      exports: [MatIcon],
    },
    add: {
      declarations: [MockMatIconComponent],
      exports: [MockMatIconComponent],
    },
  });
}
