import { NgModule } from "@angular/core";
import { SizeDisplayPipe } from "../pipes/size-display.pipe";
import { TrustHtmlPipe } from "../pipes/trust-html.pipe";

@NgModule({
  declarations: [TrustHtmlPipe, SizeDisplayPipe],
  exports: [TrustHtmlPipe, SizeDisplayPipe],
})
export class PipesModule {}
