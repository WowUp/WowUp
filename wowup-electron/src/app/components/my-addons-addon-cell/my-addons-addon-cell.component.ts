import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";

import { Component, Input } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { ADDON_PROVIDER_UNKNOWN } from "../../../common/constants";
import { AddonChannelType, AddonDependencyType, AddonWarningType } from "../../../common/wowup/models";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import * as AddonUtils from "../../utils/addon.utils";
import { capitalizeString } from "../../utils/string.utils";

interface MyAddonsAddonCellComponentParams extends ICellRendererParams {
  showUpdateToVersion: boolean;
}

@Component({
  selector: "app-my-addons-addon-cell",
  templateUrl: "./my-addons-addon-cell.component.html",
  styleUrls: ["./my-addons-addon-cell.component.scss"],
})
export class MyAddonsAddonCellComponent implements AgRendererComponent {
  @Input("addon") public listItem!: AddonViewModel;

  public readonly capitalizeString = capitalizeString;
  public readonly unknownProviderName = ADDON_PROVIDER_UNKNOWN;

  public showUpdateToVersion = false;
  public warningType?: AddonWarningType;
  public warningText?: string;
  public hasMultipleProviders = false;

  public get dependencyTooltip(): any {
    return {
      dependencyCount: this.getRequireDependencyCount(),
    };
  }

  public get channelTranslationKey(): string {
    const channelType = this.listItem.addon?.channelType ?? AddonChannelType.Stable;
    return channelType === AddonChannelType.Alpha
      ? "COMMON.ENUM.ADDON_CHANNEL_TYPE.ALPHA"
      : "COMMON.ENUM.ADDON_CHANNEL_TYPE.BETA";
  }

  public constructor(private _translateService: TranslateService, private _dialogFactory: DialogFactory) {}

  public agInit(params: MyAddonsAddonCellComponentParams): void {
    this.listItem = params.data;
    this.showUpdateToVersion = this.listItem.showUpdate;

    this.warningType = this.listItem.addon?.warningType;
    this.warningText = this.getWarningText();

    this.hasMultipleProviders =
      this.listItem.addon === undefined ? false : AddonUtils.hasMultipleProviders(this.listItem.addon);
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}

  public viewDetails(): void {
    this._dialogFactory.getAddonDetailsDialog(this.listItem);
  }

  public getThumbnailUrl(): string {
    return this.listItem?.addon?.thumbnailUrl ?? "";
  }

  public getRequireDependencyCount(): number {
    return this.listItem.getDependencies(AddonDependencyType.Required).length;
  }

  public hasRequiredDependencies(): boolean {
    return this.getRequireDependencyCount() > 0;
  }

  public hasIgnoreReason(): boolean {
    return !!this.listItem?.addon?.ignoreReason;
  }

  public getIgnoreTooltipKey(): string {
    switch (this.listItem.addon?.ignoreReason) {
      case "git_repo":
        return "PAGES.MY_ADDONS.ADDON_IS_CODE_REPOSITORY";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  public getIgnoreIcon(): string {
    switch (this.listItem.addon?.ignoreReason) {
      case "git_repo":
        return "fas:code";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  public hasWarning(): boolean {
    return this.warningType !== undefined;
  }

  public getWarningText(): string {
    if (!this.warningType) {
      return "";
    }

    const toolTipParams = {
      providerName: this.listItem.providerName,
    };

    switch (this.warningType) {
      case AddonWarningType.MissingOnProvider:
        return this._translateService.instant("COMMON.ADDON_WARNING.MISSING_ON_PROVIDER_TOOLTIP", toolTipParams);
      case AddonWarningType.NoProviderFiles:
        return this._translateService.instant("COMMON.ADDON_WARNING.NO_PROVIDER_FILES_TOOLTIP", toolTipParams);
      default:
        return this._translateService.instant("COMMON.ADDON_WARNING.GENERIC_TOOLTIP", toolTipParams);
    }
  }
}
