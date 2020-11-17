import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { GetAddonListItemFilePropPipe } from "./get-addon-list-item-file-prop.pipe";

describe("GetAddonListItemFilePropPipe", () => {
  let directive: GetAddonListItemFilePropPipe;
  let fixture: ComponentFixture<GetAddonListItemFilePropPipe>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [GetAddonListItemFilePropPipe],
      }).compileComponents();
    })
  );

  it("should create an instance", () => {
    fixture = TestBed.createComponent(GetAddonListItemFilePropPipe);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
