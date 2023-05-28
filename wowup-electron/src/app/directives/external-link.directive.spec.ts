import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ExternalLinkDirective } from "./external-link.directive";
import { Component } from "@angular/core";
import { getStandardImports, mockPreload } from "../tests/test-helpers";
import { WowUpService } from "../services/wowup/wowup.service";
import { MatLegacyDialog as MatDialog } from "@angular/material/legacy-dialog";
import { LinkService } from "../services/links/link.service";

@Component({
  template: `<a appExternalLink href="http://localhost:2020/">test link</a>`,
})
class TestAppExternalLinkComponent {}

describe("ExternalLinkDirective", () => {
  let component: TestAppExternalLinkComponent;
  let fixture: ComponentFixture<TestAppExternalLinkComponent>;
  let wowUpService: any;
  let linkService: any;

  beforeEach(async () => {
    mockPreload();

    linkService = jasmine.createSpyObj("LinkService", [""], {});
    wowUpService = jasmine.createSpyObj("WowUpService", ["openExternalLink"], {});

    await TestBed.configureTestingModule({
      declarations: [TestAppExternalLinkComponent, ExternalLinkDirective],
      providers: [MatDialog],
      imports: [...getStandardImports()],
    })
      .overrideComponent(TestAppExternalLinkComponent, {
        set: {
          providers: [
            { provide: LinkService, useValue: linkService },
            { provide: WowUpService, useValue: wowUpService },
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
