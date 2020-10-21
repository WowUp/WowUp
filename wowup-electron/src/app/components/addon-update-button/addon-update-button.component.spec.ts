import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddonUpdateButtonComponent } from './addon-update-button.component';

describe('AddonUpdateButtonComponent', () => {
  let component: AddonUpdateButtonComponent;
  let fixture: ComponentFixture<AddonUpdateButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddonUpdateButtonComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonUpdateButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
