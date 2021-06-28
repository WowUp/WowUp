import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AddonThumbnailComponent } from "./addon-thumbnail.component";

describe("AddonThumbnailComponent", () => {
  let component: AddonThumbnailComponent;
  let fixture: ComponentFixture<AddonThumbnailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddonThumbnailComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonThumbnailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
