import { ComponentFixture, TestBed } from "@angular/core/testing";
import { InterfaceFormatPipe } from "./interface-format.pipe";
import { Component } from "@angular/core";

@Component({
  template: `<p>{{ version | interfaceFormat }}</p>`,
})
class TestInterfaceFormatComponent {
  public version: string = "";
}

describe("InterfaceFormatPipe", () => {
  let component: TestInterfaceFormatComponent;
  let fixture: ComponentFixture<TestInterfaceFormatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestInterfaceFormatComponent, InterfaceFormatPipe],
    }).compileComponents();

    fixture = TestBed.createComponent(TestInterfaceFormatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should transform .toc format to semver", () => {
    component.version = "90002";
    fixture.detectChanges();
    let p = fixture.debugElement.nativeElement.querySelector("p");
    expect(p.innerHTML).toBe("9.0.2");
  });

  it("should leave any dot version alone", () => {
    let p: HTMLElement;

    component.version = "0.1";
    fixture.detectChanges();
    p = fixture.debugElement.nativeElement.querySelector("p");
    expect(p.innerHTML).toBe("0.1");

    component.version = "8.3.1";
    fixture.detectChanges();
    p = fixture.debugElement.nativeElement.querySelector("p");
    expect(p.innerHTML).toBe("8.3.1");
  });
});
