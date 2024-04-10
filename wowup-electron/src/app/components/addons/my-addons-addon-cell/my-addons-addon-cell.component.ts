import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";
import { BehaviorSubject, combineLatest } from "rxjs";
import { filter, map } from "rxjs/operators";

import { Component } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { ADDON_PROVIDER_UNKNOWN } from "../../../../common/constants";
import { AddonViewModel } from "../../../business-objects/addon-view-model";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { SessionService } from "../../../services/session/session.service";
import * as AddonUtils from "../../../utils/addon.utils";
import { AddonChannelType, AddonDependencyType, AddonWarningType } from "wowup-lib-core";

@Component({
  selector: "app-my-addons-addon-cell",
  templateUrl: "./my-addons-addon-cell.component.html",
  styleUrls: ["./my-addons-addon-cell.component.scss"],
})
export class MyAddonsAddonCellComponent implements AgRendererComponent {
  private readonly _listItemSrc = new BehaviorSubject<AddonViewModel | undefined>(undefined);

  public readonly listItem$ = this._listItemSrc.asObservable().pipe(filter((item) => item !== undefined));

  public readonly name$ = this.listItem$.pipe(map((item) => item.name));

  public readonly isIgnored$ = this.listItem$.pipe(map((item) => item.isIgnored));

  public readonly hasWarning$ = this.listItem$.pipe(map((item) => this.hasWarning(item)));

  public readonly hasFundingLinks$ = this.listItem$.pipe(
    map((item) => Array.isArray(item.addon?.fundingLinks) && item.addon.fundingLinks.length > 0),
  );

  public readonly fundingLinks$ = this.listItem$.pipe(map((item) => item.addon?.fundingLinks ?? []));

  public readonly showChannel$ = this.listItem$.pipe(map((item) => item.isBetaChannel() || item.isAlphaChannel()));

  public readonly channelClass$ = this.listItem$.pipe(
    map((item) => {
      if (item.isBetaChannel()) {
        return "beta";
      }
      if (item.isAlphaChannel()) {
        return "alpha";
      }
      return "";
    }),
  );

  public readonly channelTranslationKey$ = this.listItem$.pipe(
    map((item) => {
      const channelType = item.addon?.channelType ?? AddonChannelType.Stable;
      return channelType === AddonChannelType.Alpha
        ? "COMMON.ENUM.ADDON_CHANNEL_TYPE.ALPHA"
        : "COMMON.ENUM.ADDON_CHANNEL_TYPE.BETA";
    }),
  );

  public readonly hasMultipleProviders$ = this.listItem$.pipe(
    map((item) => (item.addon === undefined ? false : AddonUtils.hasMultipleProviders(item.addon))),
  );

  public readonly autoUpdateEnabled$ = this.listItem$.pipe(map((item) => item.addon?.autoUpdateEnabled ?? false));

  public readonly hasIgnoreReason$ = this.listItem$.pipe(map((item) => this.hasIgnoreReason(item)));

  public readonly hasRequiredDependencies$ = this.listItem$.pipe(
    map((item) => this.getRequireDependencyCount(item) > 0),
  );

  public readonly dependencyTooltip$ = this.listItem$.pipe(
    map((item) => {
      return {
        dependencyCount: this.getRequireDependencyCount(item),
      };
    }),
  );

  public readonly isLoadOnDemand$ = this.listItem$.pipe(map((item) => item.isLoadOnDemand));

  public readonly ignoreTooltipKey$ = this.listItem$.pipe(map((item) => this.getIgnoreTooltipKey(item)));

  public readonly ignoreIcon$ = this.listItem$.pipe(map((item) => this.getIgnoreIcon(item)));

  public readonly warningText$ = this.listItem$.pipe(
    filter((item) => this.hasWarning(item)),
    map((item) => this.getWarningText(item)),
  );

  public readonly isUnknownAddon$ = this.listItem$.pipe(
    map((item) => {
      return (
        !item.isLoadOnDemand &&
        !this.hasIgnoreReason(item) &&
        !this.hasWarning(item) &&
        item.addon.providerName === ADDON_PROVIDER_UNKNOWN
      );
    }),
  );

  public readonly installedVersion$ = this.listItem$.pipe(map((item) => item.addon.installedVersion));

  public readonly latestVersion$ = this.listItem$.pipe(map((item) => item.addon.latestVersion));

  public readonly thumbnailUrl$ = this.listItem$.pipe(map((item) => item.addon.thumbnailUrl));

  public readonly showUpdateVersion$ = combineLatest([
    this.listItem$,
    this.sessionService.myAddonsCompactVersion$,
  ]).pipe(
    map(([item, compactVersion]) => {
      return compactVersion && item.needsUpdate();
    }),
  );

  public set listItem(item: AddonViewModel) {
    this._listItemSrc.next(item);
  }

  public constructor(
    private _translateService: TranslateService,
    private _dialogFactory: DialogFactory,
    public sessionService: SessionService,
  ) {}

  public agInit(params: ICellRendererParams): void {
    this._listItemSrc.next(params.data as AddonViewModel);
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}

  public viewDetails(): void {
    this._dialogFactory.getAddonDetailsDialog(this._listItemSrc.value);
  }

  public getRequireDependencyCount(item: AddonViewModel): number {
    return item.getDependencies(AddonDependencyType.Required).length;
  }

  public hasIgnoreReason(item: AddonViewModel): boolean {
    return !!item?.addon?.ignoreReason;
  }

  public getIgnoreTooltipKey(item: AddonViewModel): string {
    switch (item.addon?.ignoreReason) {
      case "git_repo":
        return "PAGES.MY_ADDONS.ADDON_IS_CODE_REPOSITORY";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  public getIgnoreIcon(item: AddonViewModel): string {
    switch (item.addon?.ignoreReason) {
      case "git_repo":
        return "fas:code";
      case "missing_dependency":
      case "unknown":
      default:
        return "";
    }
  }

  public hasWarning(item: AddonViewModel): boolean {
    return item?.addon?.warningType !== undefined;
  }

  public getWarningText(item: AddonViewModel): string {
    console.log(item);
    if (!this.hasWarning(this._listItemSrc.value)) {
      return "data";
    }

    const toolTipParams = {
      providerName: this._listItemSrc.value.providerName,
    };

    switch (item.addon.warningType) {
      case AddonWarningType.MissingOnProvider:
        return this._translateService.instant("COMMON.ADDON_WARNING.MISSING_ON_PROVIDER_TOOLTIP", toolTipParams);
      case AddonWarningType.NoProviderFiles:
        return this._translateService.instant("COMMON.ADDON_WARNING.NO_PROVIDER_FILES_TOOLTIP", toolTipParams);
      case AddonWarningType.TocNameMismatch:
        return this._translateService.instant("COMMON.ADDON_WARNING.TOC_NAME_MISMATCH_TOOLTIP", toolTipParams);
      case AddonWarningType.GameVersionTocMissing:
        return this._translateService.instant("COMMON.ADDON_WARNING.GAME_VERSION_TOC_MISSING_TOOLTIP", toolTipParams);
      default:
        return this._translateService.instant("COMMON.ADDON_WARNING.GENERIC_TOOLTIP", toolTipParams);
    }
  }
}
