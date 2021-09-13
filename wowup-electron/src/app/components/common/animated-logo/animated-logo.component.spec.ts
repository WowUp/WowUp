import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ElectronService } from "../../../services";

import { AnimatedLogoComponent } from "./animated-logo.component";

describe("AnimatedLogoComponent", () => {
  let component: AnimatedLogoComponent;
  let fixture: ComponentFixture<AnimatedLogoComponent>;
  let electronServiceSpy: ElectronService;

  beforeEach(async () => {
    electronServiceSpy = jasmine.createSpyObj(
      "ElectronService",
      {},
      {
        platform: "test-harness",
      }
    );

    await TestBed.configureTestingModule({
      declarations: [AnimatedLogoComponent],
    })
      .overrideComponent(AnimatedLogoComponent, {
        set: {
          providers: [{ provide: ElectronService, useValue: electronServiceSpy }],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimatedLogoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
