import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { DownloadCountPipe } from "./download-count.pipe";

describe("DownloadCountPipe", () => {
  let directive: DownloadCountPipe;
  let fixture: ComponentFixture<DownloadCountPipe>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [DownloadCountPipe],
      }).compileComponents();
    })
  );

  it("should create an instance", () => {
    fixture = TestBed.createComponent(DownloadCountPipe);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
