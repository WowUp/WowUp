import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { LightboxModule } from "ng-gallery/lightbox";
import { AddonDetailComponent } from "../components/addons/addon-detail/addon-detail.component";
import { MatModule } from "../mat-module";
import { CommonUiModule } from "./common-ui.module";

@NgModule({
  declarations: [AddonDetailComponent],
  imports: [CommonModule, TranslateModule, MatModule, CommonUiModule, LightboxModule],
  exports: [AddonDetailComponent],
})
export class AddonsModule {}
