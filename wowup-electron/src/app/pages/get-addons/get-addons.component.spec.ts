import { async, ComponentFixture, TestBed } from "@angular/core/testing";
import { GetAddonsComponent } from "./get-addons.component";


describe("GetAddonsComponent", () => {
  let component: GetAddonsComponent;
  let fixture: ComponentFixture<GetAddonsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [GetAddonsComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GetAddonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
