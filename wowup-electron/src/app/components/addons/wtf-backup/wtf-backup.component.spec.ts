import { ComponentFixture, TestBed } from "@angular/core/testing";

import { WtfBackupComponent } from "./wtf-backup.component";

describe("WtfBackupComponent", () => {
  let component: WtfBackupComponent;
  let fixture: ComponentFixture<WtfBackupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WtfBackupComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WtfBackupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
