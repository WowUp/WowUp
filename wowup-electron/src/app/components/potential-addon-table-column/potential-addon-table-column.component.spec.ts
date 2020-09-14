import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PotentialAddonTableColumnComponent } from './potential-addon-table-column.component';

describe('PotentialAddonTableColumnComponent', () => {
  let component: PotentialAddonTableColumnComponent;
  let fixture: ComponentFixture<PotentialAddonTableColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PotentialAddonTableColumnComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PotentialAddonTableColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
