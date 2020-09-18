import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddonContextMenuComponent } from './addon-context-menu.component';

describe('AddonContextMenuComponent', () => {
  let component: AddonContextMenuComponent;
  let fixture: ComponentFixture<AddonContextMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddonContextMenuComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddonContextMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
