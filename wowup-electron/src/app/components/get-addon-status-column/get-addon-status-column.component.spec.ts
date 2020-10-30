import { ComponentFixture, TestBed } from "@angular/core/testing";
import { GetAddonStatusColumnComponent } from "./get-addon-status-column.component";

describe("GetAddonStatusColumnComponent", () => {
  let component: GetAddonStatusColumnComponent;
  let fixture: ComponentFixture<GetAddonStatusColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GetAddonStatusColumnComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GetAddonStatusColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
