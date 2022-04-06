import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TreeModule } from "@circlon/angular-tree-component";
import { TranslateModule } from "@ngx-translate/core";

import { AboutComponent } from "../components/options/about/about.component";
import { OptionsAddonSectionComponent } from "../components/options/options-addon-section/options-addon-section.component";
import { OptionsAppSectionComponent } from "../components/options/options-app-section/options-app-section.component";
import { OptionsDebugSectionComponent } from "../components/options/options-debug-section/options-debug-section.component";
import { OptionsWowSectionComponent } from "../components/options/options-wow-section/options-wow-section.component";
import { WowClientOptionsComponent } from "../components/options/wow-client-options/wow-client-options.component";
import { WtfExplorerComponent } from "../components/options/wtf-explorer/wtf-explorer.component";
import { MatModule } from "./mat-module";
import { PipesModule } from "./pipes.module";
import { DirectiveModule } from "./directive.module";

@NgModule({
  declarations: [
    WtfExplorerComponent,
    AboutComponent,
    OptionsAddonSectionComponent,
    OptionsAppSectionComponent,
    OptionsDebugSectionComponent,
    OptionsWowSectionComponent,
    WowClientOptionsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    MatModule,
    TreeModule,
    PipesModule,
    DirectiveModule,
  ],
  exports: [
    WtfExplorerComponent,
    AboutComponent,
    OptionsAddonSectionComponent,
    OptionsAppSectionComponent,
    OptionsDebugSectionComponent,
    OptionsWowSectionComponent,
    WowClientOptionsComponent,
  ],
})
export class OptionsModule {}
