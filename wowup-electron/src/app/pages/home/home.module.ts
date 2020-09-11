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

@NgModule({
  declarations: [
    HomeComponent,
    MyAddonsComponent,
    AboutComponent,
    GetAddonsComponent,
    OptionsComponent,
    ExternalLinkDirective,
  ],
  imports: [
    AgGridModule.withComponents([
      AddonTableColumnComponent,
      AddonStatusColumnComponent
    ]),
    CommonModule,
    SharedModule,
    HomeRoutingModule,
    MatModule
  ]
})
export class HomeModule { }
