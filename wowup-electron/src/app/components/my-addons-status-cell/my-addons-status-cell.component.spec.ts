import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyAddonsStatusCellComponent } from './my-addons-status-cell.component';

describe('MyAddonsStatusCellComponent', () => {
  let component: MyAddonsStatusCellComponent;
  let fixture: ComponentFixture<MyAddonsStatusCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MyAddonsStatusCellComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonsStatusCellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
