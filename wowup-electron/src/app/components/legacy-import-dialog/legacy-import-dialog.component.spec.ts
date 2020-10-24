import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LegacyImportDialogComponent } from './legacy-import-dialog.component';

describe('LegacyImportDialogComponent', () => {
  let component: LegacyImportDialogComponent;
  let fixture: ComponentFixture<LegacyImportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LegacyImportDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LegacyImportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
