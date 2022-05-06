import { AgGridModule } from "ag-grid-angular";

import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";

import { GetAddonStatusColumnComponent } from "../../components/addons/get-addon-status-cell/get-addon-status-cell.component";
import { PotentialAddonTableCellComponent } from "../../components/addons/potential-addon-table-cell/potential-addon-table-cell.component";
import { TableContextHeaderCellComponent } from "../../components/addons/table-context-header-cell/table-context-header-cell.component";
import { NewsPanelComponent } from "../../components/news-panel/news-panel.component";
import { DirectiveModule } from "../../modules/directive.module";
import { MatModule } from "../../modules/mat-module";
import { AddonsModule } from "../../modules/addons.module";
import { CommonUiModule } from "../../modules/common-ui.module";
import { OptionsModule } from "../../modules/options.module";
import { PipesModule } from "../../modules/pipes.module";
import { AccountPageComponent } from "../account-page/account-page.component";
import { GetAddonsComponent } from "../get-addons/get-addons.component";
import { MyAddonsComponent } from "../my-addons/my-addons.component";
import { OptionsComponent } from "../options/options.component";
import { HomeRoutingModule } from "./home-routing.module";
import { HomeComponent } from "./home.component";

@NgModule({
  declarations: [
    HomeComponent,
    MyAddonsComponent,
    GetAddonsComponent,
    OptionsComponent,
    AccountPageComponent,
    NewsPanelComponent,
  ],
  imports: [
    CommonModule,
    CommonUiModule,
    PipesModule,
    AddonsModule,
    HomeRoutingModule,
    MatModule,
    DirectiveModule,
    ReactiveFormsModule,
    TranslateModule,
    FormsModule,
    OptionsModule,
    AgGridModule.withComponents([
      PotentialAddonTableCellComponent,
      GetAddonStatusColumnComponent,
      TableContextHeaderCellComponent,
    ]),
  ],
  providers: [],
})
export class HomeModule {}
