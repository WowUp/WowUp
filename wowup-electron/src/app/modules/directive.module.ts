import { NgModule } from "@angular/core";

import { ExternalLinkDirective } from "../directives/external-link.directive";

@NgModule({
  declarations: [ExternalLinkDirective],
  exports: [ExternalLinkDirective],
})
export class DirectiveModule {}
