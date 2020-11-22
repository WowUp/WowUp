import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { TranslateModule } from "@ngx-translate/core";
import { HomeComponent } from "./home.component";
import { MatOptionModule } from "@angular/material/core";

describe("HomeComponent", () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [HomeComponent],
        imports: [MatOptionModule, TranslateModule.forRoot(), RouterTestingModule],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it(
    "should render title in a h1 tag",
    waitForAsync(() => {
      const compiled = fixture.debugElement.nativeElement;
      expect(compiled.querySelector("h1").textContent).toContain("PAGES.HOME.TITLE");
    })
  );
});
