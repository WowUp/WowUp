import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionsDebugSectionComponent } from './options-debug-section.component';

describe('OptionsDebugSectionComponent', () => {
  let component: OptionsDebugSectionComponent;
  let fixture: ComponentFixture<OptionsDebugSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OptionsDebugSectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsDebugSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
