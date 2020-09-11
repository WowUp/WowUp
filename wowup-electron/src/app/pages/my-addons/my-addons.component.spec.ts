import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MyAddonsComponent } from './my-addons.component';

describe('MyAddonsComponent', () => {
  let component: MyAddonsComponent;
  let fixture: ComponentFixture<MyAddonsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MyAddonsComponent ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
