import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddonTableColumnComponent } from './addon-table-column.component';

describe('AddonTableColumnComponent', () => {
  let component: AddonTableColumnComponent;
  let fixture: ComponentFixture<AddonTableColumnComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddonTableColumnComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonTableColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
