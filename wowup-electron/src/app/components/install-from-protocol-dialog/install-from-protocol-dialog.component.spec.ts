import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstallFromProtocolDialogComponent } from './install-from-protocol-dialog.component';

describe('InstallFromProtocolDialogComponent', () => {
  let component: InstallFromProtocolDialogComponent;
  let fixture: ComponentFixture<InstallFromProtocolDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstallFromProtocolDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InstallFromProtocolDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
