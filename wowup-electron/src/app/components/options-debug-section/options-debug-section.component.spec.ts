import { ComponentFixture, TestBed } from "@angular/core/testing";
import { OptionsDebugSectionComponent } from "./options-debug-section.component";
import { AddonService } from "../../services/addons/addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";

describe("OptionsDebugSectionComponent", () => {
  let component: OptionsDebugSectionComponent;
  let fixture: ComponentFixture<OptionsDebugSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OptionsDebugSectionComponent],
      providers: [
        { provider: AddonService, useValue: jasmine.createSpyObj(AddonService, ['logDebugData']) },
        { provider: WowUpService, useValue: jasmine.createSpyObj(WowUpService, ['showLogsFolder']) },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsDebugSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
