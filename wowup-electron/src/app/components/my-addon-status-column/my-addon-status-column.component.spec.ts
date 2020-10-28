import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MyAddonStatusColumnComponent } from "./my-addon-status-column.component";

describe("MyAddonStatusColumnComponent", () => {
  let component: MyAddonStatusColumnComponent;
  let fixture: ComponentFixture<MyAddonStatusColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyAddonStatusColumnComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonStatusColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
