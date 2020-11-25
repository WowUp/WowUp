import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { HomeRoutingModule } from "./pages/home/home-routing.module";
import { PageNotFoundComponent } from "./shared/components";

const routes: Routes = [
  {
    path: "",
    redirectTo: "home",
    pathMatch: "full",
  },
  {
    path: "**",
    component: PageNotFoundComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: "legacy" }), HomeRoutingModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
