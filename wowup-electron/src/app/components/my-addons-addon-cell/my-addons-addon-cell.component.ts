import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { AddonDependencyType } from "../../models/wowup/addon-dependency-type";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import * as AddonUtils from "../../utils/addon.utils";
import { capitalizeString } from "../../utils/string.utils";

@Component({
  selector: "app-my-addons-addon-cell",
  templateUrl: "./my-addons-addon-cell.component.html",
  styleUrls: ["./my-addons-addon-cell.component.scss"],
})
export class MyAddonsAddonCellComponent implements OnInit {
  @Input("addon") listItem: AddonViewModel;
  @Input() showUpdateToVersion = false;

  @Output() onViewDetails: EventEmitter<AddonViewModel> = new EventEmitter();

  public readonly capitalizeString = capitalizeString;

  public addonUtils = AddonUtils;

  constructor() {}

  ngOnInit(): void {}

  viewDetails() {
    this.onViewDetails.emit(this.listItem);
  }

  getRequireDependencyCount() {
    return this.listItem.getDependencies(AddonDependencyType.Required).length;
  }

  hasRequiredDependencies() {
    return this.getRequireDependencyCount() > 0;
  }

  hasIgnoreReason() {
    return !!this.listItem?.addon?.ignoreReason;
  }

  getIgnoreTooltipKey() {
    switch (this.listItem.addon.ignoreReason) {
      case "git_repo":
        return "PAGES.MY_ADDONS.ADDON_IS_CODE_REPOSITORY";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  getIgnoreIcon() {
    switch (this.listItem.addon.ignoreReason) {
      case "git_repo":
        return "fas:code";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  get dependencyTooltip() {
    return {
      dependencyCount: this.getRequireDependencyCount(),
    };
  }
}
