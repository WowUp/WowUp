import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ExternalLinkDirective } from "./external-link.directive";
import { Component } from "@angular/core";
import { ElectronService } from "../services";

@Component({
  template: `<a appExternalLink href="http://localhost:2020/">test link</a>`,
})
class TestAppExternalLinkComponent {}

describe("ExternalLinkDirective", () => {
  let component: TestAppExternalLinkComponent;
  let fixture: ComponentFixture<TestAppExternalLinkComponent>;
  let electronService: ElectronService;
  let electronServiceSpy: any;
  let shellSpy: any;

  beforeEach(async () => {
    shellSpy = jasmine.createSpyObj("Shell", ["openExternal"]);
    electronServiceSpy = jasmine.createSpyObj("ElectronService", ["openExternal"], { shell: shellSpy });

    await TestBed.configureTestingModule({
      declarations: [TestAppExternalLinkComponent, ExternalLinkDirective],
    })
      .overrideComponent(TestAppExternalLinkComponent, {
        set: {
          providers: [{ provide: ElectronService, useValue: electronServiceSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TestAppExternalLinkComponent);
    component = fixture.componentInstance;
    electronService = fixture.debugElement.injector.get(ElectronService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should call openExternal on click", async () => {
    let a = fixture.debugElement.nativeElement.querySelector("a");
    a.click();
    fixture.detectChanges();
    expect(electronServiceSpy.openExternal).toHaveBeenCalledWith("http://localhost:2020/");
  });
});
