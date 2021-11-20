import { NgModule } from "@angular/core";

import { WebviewComponent } from "../directives/webview.component";
import { ExternalLinkDirective } from "../directives/external-link.directive";

@NgModule({
  declarations: [ExternalLinkDirective, WebviewComponent],
  exports: [ExternalLinkDirective, WebviewComponent],
})
export class DirectiveModule {}
