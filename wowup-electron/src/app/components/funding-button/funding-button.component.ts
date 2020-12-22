import { Component, Input, OnInit } from "@angular/core";
import { AddonFundingLink } from "../../entities/addon";

@Component({
  selector: "app-funding-button",
  templateUrl: "./funding-button.component.html",
  styleUrls: ["./funding-button.component.scss"],
})
export class FundingButtonComponent implements OnInit {
  @Input("funding") funding: AddonFundingLink;
  @Input("size") size: "large" | "small" = "large";

  constructor() {}

  ngOnInit(): void {}

  getTooltipKey() {
    return `PAGES.MY_ADDONS.FUNDING_TOOLTIP.${this.funding.platform.toUpperCase()}`;
  }

  getFundingIcon() {
    switch (this.funding.platform) {
      case "LIBERAPAY":
        return "assets/images/librepay_logo_small.png";
      case "PATREON":
        return "assets/images/patreon_logo_white.png";
      case "GITHUB":
        return "assets/images/github_logo_small.png";
      case "CUSTOM":
      default:
        return "assets/images/custom_funding_logo_small.png";
    }
  }

  getFundingName() {
    switch (this.funding.platform) {
      case "LIBERAPAY":
        return "Liberapay";
      case "PATREON":
        return "Patreon";
      case "GITHUB":
        return "GitHub";
      case "PAYPAL":
        return "PayPal";
      case "CUSTOM":
      default:
        return "Custom";
    }
  }
}
