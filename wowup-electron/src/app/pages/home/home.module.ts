import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../../shared/shared.module';
import { MatModule } from '../../mat-module';
import { AddonTableColumnComponent } from 'app/components/addon-table-column/addon-table-column.component';
import { AddonStatusColumnComponent } from 'app/components/addon-status-column/addon-status-column.component';
import { MyAddonsComponent } from '../my-addons/my-addons.component';
import { OptionsComponent } from '../options/options.component';
import { ExternalLinkDirective } from 'app/directives/external-link.directive';
import { GetAddonsComponent } from '../get-addons/get-addons.component';
import { AboutComponent } from '../about/about.component';
import { PotentialAddonTableColumnComponent } from 'app/components/potential-addon-table-column/potential-addon-table-column.component';
import { PotentialAddonStatusColumnComponent } from 'app/components/potential-addon-status-column/potential-addon-status-column.component';
import { MyAddonsAddonCellComponent } from 'app/components/my-addons-addon-cell/my-addons-addon-cell.component';
import { MyAddonsStatusCellComponent } from 'app/components/my-addons-status-cell/my-addons-status-cell.component';
import { AddonContextMenuComponent } from 'app/components/addon-context-menu/addon-context-menu.component';

@NgModule({
  declarations: [
    HomeComponent,
    MyAddonsComponent,
    AboutComponent,
    GetAddonsComponent,
    OptionsComponent,
    ExternalLinkDirective,
    MyAddonsAddonCellComponent,
    MyAddonsStatusCellComponent,
    AddonContextMenuComponent,
    PotentialAddonStatusColumnComponent
  ],
  imports: [
    AgGridModule.withComponents([
      AddonTableColumnComponent,
      AddonStatusColumnComponent,
      PotentialAddonTableColumnComponent,
    ]),
    CommonModule,
    SharedModule,
    HomeRoutingModule,
    MatModule
  ]
})
export class HomeModule { }
