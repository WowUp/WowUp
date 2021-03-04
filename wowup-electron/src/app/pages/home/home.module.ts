import { AgGridModule } from "ag-grid-angular";

import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { AddonDetailComponent } from "../../components/addon-detail/addon-detail.component";
import { AddonInstallButtonComponent } from "../../components/addon-install-button/addon-install-button.component";
import { AddonUpdateButtonComponent } from "../../components/addon-update-button/addon-update-button.component";
import { AlertDialogComponent } from "../../components/alert-dialog/alert-dialog.component";
import { CenteredSnackbarComponent } from "../../components/centered-snackbar/centered-snackbar.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { FundingButtonComponent } from "../../components/funding-button/funding-button.component";
import { GetAddonStatusColumnComponent } from "../../components/get-addon-status-column/get-addon-status-column.component";
import { InstallFromUrlDialogComponent } from "../../components/install-from-url-dialog/install-from-url-dialog.component";
import { MyAddonStatusColumnComponent } from "../../components/my-addon-status-column/my-addon-status-column.component";
import { MyAddonsAddonCellComponent } from "../../components/my-addons-addon-cell/my-addons-addon-cell.component";
import { OptionsAddonSectionComponent } from "../../components/options-addon-section/options-addon-section.component";
import { OptionsAppSectionComponent } from "../../components/options-app-section/options-app-section.component";
import { OptionsDebugSectionComponent } from "../../components/options-debug-section/options-debug-section.component";
import { OptionsWowSectionComponent } from "../../components/options-wow-section/options-wow-section.component";
import { PotentialAddonTableColumnComponent } from "../../components/potential-addon-table-column/potential-addon-table-column.component";
import { ProgressButtonComponent } from "../../components/progress-button/progress-button.component";
import { ProgressSpinnerComponent } from "../../components/progress-spinner/progress-spinner.component";
import { TelemetryDialogComponent } from "../../components/telemetry-dialog/telemetry-dialog.component";
import { WowClientOptionsComponent } from "../../components/wow-client-options/wow-client-options.component";
import { TableContextHeaderCellComponent } from "../../components/table-context-header-cell/table-context-header-cell.component";
import { DirectiveModule } from "../../directive.module";
import { MatModule } from "../../mat-module";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";
import { GetAddonListItemFilePropPipe } from "../../pipes/get-addon-list-item-file-prop.pipe";
import { InterfaceFormatPipe } from "../../pipes/interface-format.pipe";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { SharedModule } from "../../shared.module";
import { AboutComponent } from "../about/about.component";
import { GetAddonsComponent } from "../get-addons/get-addons.component";
import { MyAddonsComponent } from "../my-addons/my-addons.component";
import { OptionsComponent } from "../options/options.component";
import { HomeRoutingModule } from "./home-routing.module";
import { HomeComponent } from "./home.component";

@NgModule({
  declarations: [
    HomeComponent,
    MyAddonsComponent,
    AboutComponent,
    GetAddonsComponent,
    OptionsComponent,
    MyAddonsAddonCellComponent,
    ProgressSpinnerComponent,
    PotentialAddonTableColumnComponent,
    DownloadCountPipe,
    InterfaceFormatPipe,
    GetAddonListItemFilePropPipe,
    RelativeDurationPipe,
    TelemetryDialogComponent,
    ConfirmDialogComponent,
    AlertDialogComponent,
    WowClientOptionsComponent,
    InstallFromUrlDialogComponent,
    AddonDetailComponent,
    AddonInstallButtonComponent,
    GetAddonStatusColumnComponent,
    MyAddonStatusColumnComponent,
    ProgressButtonComponent,
    AddonUpdateButtonComponent,
    OptionsWowSectionComponent,
    OptionsAppSectionComponent,
    OptionsDebugSectionComponent,
    OptionsAddonSectionComponent,
    FundingButtonComponent,
    CenteredSnackbarComponent,
    TableContextHeaderCellComponent,
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
  ],
  providers: [DatePipe, GetAddonListItemFilePropPipe, DownloadCountPipe, RelativeDurationPipe],
})
export class HomeModule {}
