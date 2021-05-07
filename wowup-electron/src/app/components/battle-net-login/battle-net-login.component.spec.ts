import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleNetLoginComponent } from './battle-net-login.component';

describe('BattleNetLoginComponent', () => {
  let component: BattleNetLoginComponent;
  let fixture: ComponentFixture<BattleNetLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BattleNetLoginComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BattleNetLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
