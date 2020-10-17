import { Directive, HostListener, Input } from '@angular/core';
import { AnalyticsService } from '../services/analytics/analytics.service';

@Directive({
  selector: '[appUserActionTracker]'
})
export class UserActionTrackerDirective {

  @Input() appUserActionTracker: string;
  @Input() category: string;
  @Input() action: string;
  @Input() label: string;

  @HostListener('click', ['$event']) onClick($event) {
    this._analyticsService.trackUserAction(this.category, this.action, this.label);
  }

  constructor(private _analyticsService: AnalyticsService) { }

}
