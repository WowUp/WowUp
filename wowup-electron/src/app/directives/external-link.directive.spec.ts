import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ExternalLinkDirective } from "./external-link.directive";
import { Component } from "@angular/core";
import { getStandardImports, mockPreload } from "../tests/test-helpers";
import { WowUpService } from "../services/wowup/wowup.service";
import { MatDialog } from "@angular/material/dialog";

@Component({
  template: `<a appExternalLink href="http://localhost:2020/">test link</a>`,
})
class TestAppExternalLinkComponent {}

describe("ExternalLinkDirective", () => {
  let component: TestAppExternalLinkComponent;
  let fixture: ComponentFixture<TestAppExternalLinkComponent>;
  let wowUpService: any;

  beforeEach(async () => {
    mockPreload();

    wowUpService = jasmine.createSpyObj("WowUpService", ["openExternalLink"], {});

    await TestBed.configureTestingModule({
      declarations: [TestAppExternalLinkComponent, ExternalLinkDirective],
      providers: [MatDialog],
      imports: [...getStandardImports()],
    })
      .overrideComponent(TestAppExternalLinkComponent, {
        set: {
          providers: [
            {
              provide: WowUpService,
              useValue: wowUpService,
            },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TestAppExternalLinkComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  // it("should call openExternal on click", () => {
  //   const a = fixture.debugElement.nativeElement.querySelector("a");
  //   a.click();
  //   fixture.detectChanges();
  //   expect(wowUpService.openExternalLink).toHaveBeenCalledWith("http://localhost:2020/");
  // });
});
