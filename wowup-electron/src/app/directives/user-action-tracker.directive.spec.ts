import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { UserActionTrackerDirective } from './user-action-tracker.directive';

describe('UserActionTrackerDirective', () => {
  let directive: UserActionTrackerDirective;
  let fixture: ComponentFixture<UserActionTrackerDirective>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [UserActionTrackerDirective],
    }).compileComponents();
  }));

  it("should create an instance", () => {
    fixture = TestBed.createComponent(UserActionTrackerDirective);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
