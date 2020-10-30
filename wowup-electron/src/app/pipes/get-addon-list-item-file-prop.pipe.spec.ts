import { async, ComponentFixture, TestBed } from "@angular/core/testing";
import { GetAddonListItemFilePropPipe } from "./get-addon-list-item-file-prop.pipe";

describe("GetAddonListItemFilePropPipe", () => {
  let directive: GetAddonListItemFilePropPipe;
  let fixture: ComponentFixture<GetAddonListItemFilePropPipe>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [GetAddonListItemFilePropPipe],
    }).compileComponents();
  }));

  it("should create an instance", () => {
    fixture = TestBed.createComponent(GetAddonListItemFilePropPipe);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
