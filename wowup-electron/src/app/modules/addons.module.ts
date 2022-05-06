import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { LightboxModule, LIGHTBOX_CONFIG } from "ng-gallery/lightbox";
import { AddonUpdateButtonComponent } from "../components/addons/addon-update-button/addon-update-button.component";
import { AddonDetailComponent } from "../components/addons/addon-detail/addon-detail.component";
import { AddonInstallButtonComponent } from "../components/addons/addon-install-button/addon-install-button.component";
import { AddonThumbnailComponent } from "../components/addons/addon-thumbnail/addon-thumbnail.component";
import { DateTooltipCellComponent } from "../components/addons/date-tooltip-cell/date-tooltip-cell.component";
import { MatModule } from "./mat-module";
import { CommonUiModule } from "./common-ui.module";
import { PipesModule } from "./pipes.module";
import { FundingButtonComponent } from "../components/addons/funding-button/funding-button.component";
import { GetAddonStatusColumnComponent } from "../components/addons/get-addon-status-cell/get-addon-status-cell.component";
import { PotentialAddonTableCellComponent } from "../components/addons/potential-addon-table-cell/potential-addon-table-cell.component";
import { TableContextHeaderCellComponent } from "../components/addons/table-context-header-cell/table-context-header-cell.component";
import { MyAddonStatusCellComponent } from "../components/addons/my-addon-status-cell/my-addon-status-cell.component";
import { InstallFromProtocolDialogComponent } from "../components/addons/install-from-protocol-dialog/install-from-protocol-dialog.component";
import { MyAddonsAddonCellComponent } from "../components/addons/my-addons-addon-cell/my-addons-addon-cell.component";
import { InstallFromUrlDialogComponent } from "../components/addons/install-from-url-dialog/install-from-url-dialog.component";
import { DirectiveModule } from "./directive.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AddonManageDialogComponent } from "../components/addons/addon-manage-dialog/addon-manage-dialog.component";
import { WtfBackupComponent } from "../components/addons/wtf-backup/wtf-backup.component";

@NgModule({
  declarations: [
    AddonUpdateButtonComponent,
    AddonDetailComponent,
    DateTooltipCellComponent,
    AddonInstallButtonComponent,
    AddonThumbnailComponent,
    FundingButtonComponent,
    GetAddonStatusColumnComponent,
    PotentialAddonTableCellComponent,
    TableContextHeaderCellComponent,
    MyAddonStatusCellComponent,
    InstallFromProtocolDialogComponent,
    MyAddonsAddonCellComponent,
    InstallFromUrlDialogComponent,
    AddonManageDialogComponent,
    WtfBackupComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    MatModule,
    CommonUiModule,
    PipesModule,
    DirectiveModule,
    LightboxModule,
  ],
  exports: [
    AddonUpdateButtonComponent,
    AddonDetailComponent,
    DateTooltipCellComponent,
    AddonInstallButtonComponent,
    AddonThumbnailComponent,
    FundingButtonComponent,
    GetAddonStatusColumnComponent,
    PotentialAddonTableCellComponent,
    TableContextHeaderCellComponent,
    MyAddonStatusCellComponent,
    InstallFromProtocolDialogComponent,
    MyAddonsAddonCellComponent,
    InstallFromUrlDialogComponent,
    AddonManageDialogComponent,
    WtfBackupComponent,
  ],
  providers: [
    {
      provide: LIGHTBOX_CONFIG,
      useValue: {
        keyboardShortcuts: true,
      },
    },
  ],
})
export class AddonsModule {}
