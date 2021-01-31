import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatModule } from "../../mat-module";
import { ProgressButtonComponent } from "./progress-button.component";

describe("ProgressButtonComponent", () => {
  let component: ProgressButtonComponent;
  let fixture: ComponentFixture<ProgressButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProgressButtonComponent],
      imports: [MatModule, NoopAnimationsModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
