import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientSelectorComponent } from './client-selector.component';

describe('ClientSelectorComponent', () => {
  let component: ClientSelectorComponent;
  let fixture: ComponentFixture<ClientSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientSelectorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClientSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
