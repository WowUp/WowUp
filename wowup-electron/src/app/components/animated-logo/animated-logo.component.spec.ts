import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimatedLogoComponent } from './animated-logo.component';

describe('AnimatedLogoComponent', () => {
  let component: AnimatedLogoComponent;
  let fixture: ComponentFixture<AnimatedLogoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AnimatedLogoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimatedLogoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
