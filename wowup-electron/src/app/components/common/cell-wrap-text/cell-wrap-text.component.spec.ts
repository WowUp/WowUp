import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CellWrapTextComponent } from "./cell-wrap-text.component";

describe("CellWrapTextComponent", () => {
  let component: CellWrapTextComponent;
  let fixture: ComponentFixture<CellWrapTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CellWrapTextComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CellWrapTextComponent);
    component = fixture.componentInstance;

    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    component.agInit({
      value: "TEST",
    } as any);
    /* eslint-enable @typescript-eslint/no-unsafe-argument */

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
