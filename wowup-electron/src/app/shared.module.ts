import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { AnimatedLogoComponent } from "./components/animated-logo/animated-logo.component";

@NgModule({
  declarations: [AnimatedLogoComponent],
  imports: [CommonModule, FormsModule, TranslateModule],
  exports: [CommonModule, FormsModule, TranslateModule, AnimatedLogoComponent],
})
export class SharedModule {}
