import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { AddonInstallButtonComponent } from "../components/addon-install-button/addon-install-button.component";
import { AddonUpdateButtonComponent } from "../components/addon-update-button/addon-update-button.component";
import { ProgressButtonComponent } from "../components/progress-button/progress-button.component";
import { ProgressSpinnerComponent } from "../components/progress-spinner/progress-spinner.component";
import { MatModule } from "../mat-module";

@NgModule({
  declarations: [
    AddonInstallButtonComponent,
    AddonUpdateButtonComponent,
    ProgressSpinnerComponent,
    ProgressButtonComponent,
  ],
  imports: [CommonModule, TranslateModule, MatModule],
  exports: [AddonInstallButtonComponent, AddonUpdateButtonComponent, ProgressSpinnerComponent, ProgressButtonComponent],
})
export class CommonUiModule {}
