import { NgModule } from "@angular/core";
import { ExternalLinkDirective } from "./directives/external-link.directive";
import { UserActionTrackerDirective } from "./directives/user-action-tracker.directive";

@NgModule({
  declarations: [ExternalLinkDirective, UserActionTrackerDirective],
  exports: [ExternalLinkDirective, UserActionTrackerDirective],
})
export class DirectiveModule {}
