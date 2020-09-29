import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WowClientOptionsComponent } from './wow-client-options.component';

describe('WowClientOptionsComponent', () => {
  let component: WowClientOptionsComponent;
  let fixture: ComponentFixture<WowClientOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WowClientOptionsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WowClientOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
