import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import { AddonProviderType } from "../../addon-providers/addon-provider";

@Component({
  selector: "app-addon-provider-badge",
  templateUrl: "./addon-provider-badge.component.html",
  styleUrls: ["./addon-provider-badge.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonProviderBadgeComponent implements OnInit {
  @Input() providerName: AddonProviderType;

  constructor() {}

  ngOnInit(): void {}

  getProviderClass() {
    let className = "";

    switch (this.providerName) {
      case "Curse":
        className = "curse";
        break;
      case "GitHub":
        className = "github";
        break;
      case "TukUI":
        className = "tukui";
        break;
      case "WowInterface":
        className = "wowinterface";
        break;
    }
    if (className) return { [className]: true };
  }
}
