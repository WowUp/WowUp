import { async, ComponentFixture, TestBed } from "@angular/core/testing";
import { ExternalLinkDirective } from "./external-link.directive";

describe("ExternalLinkDirective", () => {
  let directive: ExternalLinkDirective;
  let fixture: ComponentFixture<ExternalLinkDirective>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ExternalLinkDirective],
    }).compileComponents();
  }));

  it("should create an instance", () => {
    fixture = TestBed.createComponent(ExternalLinkDirective);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
