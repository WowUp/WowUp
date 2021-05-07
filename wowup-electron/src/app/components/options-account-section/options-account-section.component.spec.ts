import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionsAccountSectionComponent } from './options-account-section.component';

describe('OptionsAccountSectionComponent', () => {
  let component: OptionsAccountSectionComponent;
  let fixture: ComponentFixture<OptionsAccountSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OptionsAccountSectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsAccountSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
