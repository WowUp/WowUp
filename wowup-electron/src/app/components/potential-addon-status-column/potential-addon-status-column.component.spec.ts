import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PotentialAddonStatusColumnComponent } from './potential-addon-status-column.component';

describe('PotentialAddonStatusColumnComponent', () => {
  let component: PotentialAddonStatusColumnComponent;
  let fixture: ComponentFixture<PotentialAddonStatusColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PotentialAddonStatusColumnComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PotentialAddonStatusColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
