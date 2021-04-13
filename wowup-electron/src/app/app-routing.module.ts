import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { HomeRoutingModule } from "./pages/home/home-routing.module";

const routes: Routes = [
  {
    path: "",
    redirectTo: "home",
    pathMatch: "full",
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: "legacy" }), HomeRoutingModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
