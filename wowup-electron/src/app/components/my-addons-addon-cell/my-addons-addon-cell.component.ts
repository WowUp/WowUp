import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonDependencyType } from "../../models/wowup/addon-dependency-type";
import { AddonWarningType } from "../../models/wowup/addon-warning-type";
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
  public warningType?: AddonWarningType;
  public warningText?: string;

  constructor(private _translateService: TranslateService) {}

  ngOnInit(): void {
    this.warningType = this.listItem.addon.warningType;
    this.warningText = this.getWarningText();
  }

  viewDetails(): void {
    if (this.hasWarning()) {
      return;
    }
    this.onViewDetails.emit(this.listItem);
  }

  getRequireDependencyCount(): number {
    return this.listItem.getDependencies(AddonDependencyType.Required).length;
  }

  hasRequiredDependencies(): boolean {
    return this.getRequireDependencyCount() > 0;
  }

  hasIgnoreReason(): boolean {
    return !!this.listItem?.addon?.ignoreReason;
  }

  getIgnoreTooltipKey(): string {
    switch (this.listItem.addon.ignoreReason) {
      case "git_repo":
        return "PAGES.MY_ADDONS.ADDON_IS_CODE_REPOSITORY";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  getIgnoreIcon(): string {
    switch (this.listItem.addon.ignoreReason) {
      case "git_repo":
        return "fas:code";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  get dependencyTooltip(): any {
    return {
      dependencyCount: this.getRequireDependencyCount(),
    };
  }

  hasWarning(): boolean {
    return this.warningType !== undefined;
  }

  getWarningText(): string {
    if (!this.warningType) {
      return "";
    }

    switch (this.warningType) {
      case AddonWarningType.MissingOnProvider:
        return this._translateService.instant("COMMON.ADDON_WARNING.MISSING_ON_PROVIDER_TOOLTIP");
      default:
        return this._translateService.instant("COMMON.ADDON_WARNING.GENERIC_TOOLTIP");
    }
  }
}
