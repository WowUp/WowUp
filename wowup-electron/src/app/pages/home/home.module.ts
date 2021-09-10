import { AgGridModule } from "ag-grid-angular";

import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { AddonThumbnailComponent } from "../../components/addon-thumbnail/addon-thumbnail.component";
import { AlertDialogComponent } from "../../components/alert-dialog/alert-dialog.component";
import { CellWrapTextComponent } from "../../components/cell-wrap-text/cell-wrap-text.component";
import { CenteredSnackbarComponent } from "../../components/centered-snackbar/centered-snackbar.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { DateTooltipCellComponent } from "../../components/date-tooltip-cell/date-tooltip-cell.component";
import { ExternalUrlConfirmationDialogComponent } from "../../components/external-url-confirmation-dialog/external-url-confirmation-dialog.component";
import { FundingButtonComponent } from "../../components/funding-button/funding-button.component";
import { GetAddonStatusColumnComponent } from "../../components/get-addon-status-column/get-addon-status-column.component";
import { InstallFromProtocolDialogComponent } from "../../components/install-from-protocol-dialog/install-from-protocol-dialog.component";
import { InstallFromUrlDialogComponent } from "../../components/install-from-url-dialog/install-from-url-dialog.component";
import { MyAddonStatusColumnComponent } from "../../components/my-addon-status-column/my-addon-status-column.component";
import { MyAddonsAddonCellComponent } from "../../components/my-addons-addon-cell/my-addons-addon-cell.component";
import { NewsPanelComponent } from "../../components/news-panel/news-panel.component";
import { PatchNotesDialogComponent } from "../../components/patch-notes-dialog/patch-notes-dialog.component";
import { PotentialAddonTableColumnComponent } from "../../components/potential-addon-table-column/potential-addon-table-column.component";
import { TableContextHeaderCellComponent } from "../../components/table-context-header-cell/table-context-header-cell.component";
import { TelemetryDialogComponent } from "../../components/telemetry-dialog/telemetry-dialog.component";
import { DirectiveModule } from "../../directive.module";
import { MatModule } from "../../mat-module";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";
import { GetAddonListItemFilePropPipe } from "../../pipes/get-addon-list-item-file-prop.pipe";
import { InterfaceFormatPipe } from "../../pipes/interface-format.pipe";
import { InvertBoolPipe } from "../../pipes/inverse-bool.pipe";
import { NgxDatePipe } from "../../pipes/ngx-date.pipe";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { SharedModule } from "../../shared.module";
import { AccountPageComponent } from "../account-page/account-page.component";
import { GetAddonsComponent } from "../get-addons/get-addons.component";
import { MyAddonsComponent } from "../my-addons/my-addons.component";
import { OptionsComponent } from "../options/options.component";
import { HomeRoutingModule } from "./home-routing.module";
import { HomeComponent } from "./home.component";
import { OptionsModule } from "../../modules/options.module";
import { AddonsModule } from "../../modules/addons.module";
import { CommonUiModule } from "../../modules/common-ui.module";

@NgModule({
  declarations: [
    HomeComponent,
    MyAddonsComponent,
    GetAddonsComponent,
    OptionsComponent,
    MyAddonsAddonCellComponent,
    AccountPageComponent,
    PotentialAddonTableColumnComponent,
    DownloadCountPipe,
    InterfaceFormatPipe,
    InvertBoolPipe,
    NgxDatePipe,
    GetAddonListItemFilePropPipe,
    RelativeDurationPipe,
    TelemetryDialogComponent,
    ConfirmDialogComponent,
    AlertDialogComponent,
    InstallFromUrlDialogComponent,
    InstallFromProtocolDialogComponent,
    GetAddonStatusColumnComponent,
    MyAddonStatusColumnComponent,
    FundingButtonComponent,
    CenteredSnackbarComponent,
    TableContextHeaderCellComponent,
    CellWrapTextComponent,
    DateTooltipCellComponent,
    AddonThumbnailComponent,
    PatchNotesDialogComponent,
    NewsPanelComponent,
    ExternalUrlConfirmationDialogComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    HomeRoutingModule,
    MatModule,
    DirectiveModule,
    ReactiveFormsModule,
    AgGridModule.withComponents([
      PotentialAddonTableColumnComponent,
      GetAddonStatusColumnComponent,
      TableContextHeaderCellComponent,
    ]),
    OptionsModule,
    AddonsModule,
    CommonUiModule,
  ],
  providers: [DatePipe, GetAddonListItemFilePropPipe, DownloadCountPipe, RelativeDurationPipe, NgxDatePipe],
})
export class HomeModule {}
