import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyAddonsAddonCellComponent } from './my-addons-addon-cell.component';

describe('MyAddonsAddonCellComponent', () => {
  let component: MyAddonsAddonCellComponent;
  let fixture: ComponentFixture<MyAddonsAddonCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MyAddonsAddonCellComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonsAddonCellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
