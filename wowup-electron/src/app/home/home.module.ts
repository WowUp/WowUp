import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';
import { MatModule } from '../mat-module';
import { MyAddonsComponent } from 'app/my-addons/my-addons.component';
import { AboutComponent } from 'app/about/about.component';
import { GetAddonsComponent } from 'app/get-addons/get-addons.component';
import { OptionsComponent } from 'app/options/options.component';
import { ExternalLinkDirective } from 'app/core/directives/external-link.directive';
import { AddonTableColumnComponent } from 'app/components/addon-table-column/addon-table-column.component';

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
      AddonTableColumnComponent
    ]),
    CommonModule,
    SharedModule,
    HomeRoutingModule,
    MatModule
  ]
})
export class HomeModule { }
