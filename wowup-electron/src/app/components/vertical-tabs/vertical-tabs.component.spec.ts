import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject } from "rxjs";
import { httpLoaderFactory } from "../../app.module";
import { MatModule } from "../../mat-module";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { getStandardImports, mockPreload } from "../../tests/test-helpers";

import { VerticalTabsComponent } from "./vertical-tabs.component";

describe("VerticalTabsComponent", () => {
  let component: VerticalTabsComponent;
  let fixture: ComponentFixture<VerticalTabsComponent>;
  let sessionService: SessionService;

  beforeEach(async () => {
    mockPreload();

    sessionService = jasmine.createSpyObj("SessionService", ["getSelectedClientType", "getSelectedDetailsTab"], {
      getSelectedWowInstallation: () => "description",
      selectedHomeTab$: new BehaviorSubject(1),
    });

    let testBed = TestBed.configureTestingModule({
      declarations: [VerticalTabsComponent],
      imports: [...getStandardImports()],
    });

    testBed = testBed.overrideComponent(VerticalTabsComponent, {
      set: {
        providers: [{ provide: SessionService, useValue: sessionService }],
      },
    });

    await testBed.compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VerticalTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
