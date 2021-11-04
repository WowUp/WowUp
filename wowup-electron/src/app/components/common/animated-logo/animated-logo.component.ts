import { Component } from "@angular/core";
import { ElectronService } from "../../../services";

@Component({
  selector: "app-animated-logo",
  templateUrl: "./animated-logo.component.html",
  styleUrls: ["./animated-logo.component.scss"],
})
export class AnimatedLogoComponent {
  public constructor(public electronService: ElectronService) {}
}
