import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WtfExplorerComponent } from './wtf-explorer.component';

describe('WtfExplorerComponent', () => {
  let component: WtfExplorerComponent;
  let fixture: ComponentFixture<WtfExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WtfExplorerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WtfExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
