import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { InterfaceFormatPipe } from "./interface-format.pipe";

describe("InterfaceFormatPipe", () => {
  let directive: InterfaceFormatPipe;
  let fixture: ComponentFixture<InterfaceFormatPipe>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [InterfaceFormatPipe],
      }).compileComponents();
    })
  );

  it("should create an instance", () => {
    fixture = TestBed.createComponent(InterfaceFormatPipe);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
