import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../../shared/shared.module';
import { MatModule } from '../../mat-module';
import { MyAddonsComponent } from '../my-addons/my-addons.component';
import { OptionsComponent } from '../options/options.component';
import { GetAddonsComponent } from '../get-addons/get-addons.component';
import { AboutComponent } from '../about/about.component';
import { PotentialAddonTableColumnComponent } from 'app/components/potential-addon-table-column/potential-addon-table-column.component';
import { PotentialAddonStatusColumnComponent } from 'app/components/potential-addon-status-column/potential-addon-status-column.component';
import { MyAddonsAddonCellComponent } from 'app/components/my-addons-addon-cell/my-addons-addon-cell.component';
import { ProgressSpinnerComponent } from 'app/components/progress-spinner/progress-spinner.component';
import { DownloadCountPipe } from 'app/pipes/download-count.pipe';
import { TelemetryDialogComponent } from 'app/components/telemetry-dialog/telemetry-dialog.component';
import { ConfirmDialogComponent } from 'app/components/confirm-dialog/confirm-dialog.component';
import { AlertDialogComponent } from 'app/components/alert-dialog/alert-dialog.component';
import { WowClientOptionsComponent } from 'app/components/wow-client-options/wow-client-options.component';
import { DirectiveModule } from 'app/directive.module';
import { InstallFromUrlDialogComponent } from 'app/components/install-from-url-dialog/install-from-url-dialog.component';

@NgModule({
  declarations: [
    HomeComponent,
    MyAddonsComponent,
    AboutComponent,
    GetAddonsComponent,
    OptionsComponent,
    MyAddonsAddonCellComponent,
    PotentialAddonStatusColumnComponent,
    ProgressSpinnerComponent,
    PotentialAddonTableColumnComponent,
    DownloadCountPipe,
    TelemetryDialogComponent,
    ConfirmDialogComponent,
    AlertDialogComponent,
    WowClientOptionsComponent,
    InstallFromUrlDialogComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    HomeRoutingModule,
    MatModule,
    DirectiveModule
  ]
})
export class HomeModule { }
