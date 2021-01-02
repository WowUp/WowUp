import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CenteredSnackbarComponent } from './centered-snackbar.component';

describe('CenteredSnackbarComponent', () => {
  let component: CenteredSnackbarComponent;
  let fixture: ComponentFixture<CenteredSnackbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CenteredSnackbarComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CenteredSnackbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
