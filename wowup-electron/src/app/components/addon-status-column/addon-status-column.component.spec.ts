import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddonStatusColumnComponent } from './addon-status-column.component';

describe('AddonStatusColumnComponent', () => {
  let component: AddonStatusColumnComponent;
  let fixture: ComponentFixture<AddonStatusColumnComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddonStatusColumnComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonStatusColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
