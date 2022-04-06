import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";

import { Component, OnInit } from "@angular/core";

import {
  FEATURE_ACCOUNTS_ENABLED,
  TAB_INDEX_ABOUT,
  TAB_INDEX_GET_ADDONS,
  TAB_INDEX_MY_ADDONS,
  TAB_INDEX_NEWS,
  TAB_INDEX_SETTINGS,
} from "../../../../common/constants";
import { AppConfig } from "../../../../environments/environment";
import { ElectronService } from "../../../services";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";

interface Tab {
  titleKey?: string;
  tooltipKey: string;
  icon: string;
  badge?: boolean;
  isSelected$: Observable<boolean>;
  isDisabled$: Observable<boolean>;
  onClick: (tab: Tab) => void;
}

@Component({
  selector: "app-horizontal-tabs",
  templateUrl: "./horizontal-tabs.component.html",
  styleUrls: ["./horizontal-tabs.component.scss"],
})
export class HorizontalTabsComponent implements OnInit {
  public wowUpWebsiteUrl = AppConfig.wowUpWebsiteUrl;
  public TAB_INDEX_ACCOUNT = TAB_INDEX_ABOUT;
  public FEATURE_ACCOUNTS_ENABLED = FEATURE_ACCOUNTS_ENABLED;

  public isAccountSelected$ = this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_ABOUT));

  private myAddonsTab: Tab = {
    titleKey: "PAGES.HOME.MY_ADDONS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.MY_ADDONS_TAB_TITLE",
    icon: "fas:dice-d6",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_MY_ADDONS)),
    isDisabled$: this._warcraftInstallationService.wowInstallations$.pipe(
      map((installations) => installations.length === 0)
    ),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_MY_ADDONS;
    },
  };

  private getAddonsTab: Tab = {
    titleKey: "PAGES.HOME.GET_ADDONS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.GET_ADDONS_TAB_TITLE",
    icon: "fas:magnifying-glass",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_GET_ADDONS)),
    isDisabled$: this._warcraftInstallationService.wowInstallations$.pipe(
      map((installations) => installations.length === 0)
    ),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_GET_ADDONS;
    },
  };

  private aboutTab: Tab = {
    titleKey: "PAGES.HOME.ACCOUNT_TAB_TITLE",
    tooltipKey: "PAGES.HOME.ACCOUNT_TAB_TITLE",
    icon: "fas:user-circle",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_ABOUT)),
    isDisabled$: of(false),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_ABOUT;
    },
  };

  private newsTab: Tab = {
    titleKey: "PAGES.HOME.NEWS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.NEWS_TAB_TITLE",
    icon: "fas:newspaper",
    badge: true,
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_NEWS)),
    isDisabled$: of(false),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_NEWS;
    },
  };

  private settingsTab: Tab = {
    titleKey: "PAGES.HOME.OPTIONS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.OPTIONS_TAB_TITLE",
    icon: "fas:gear",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_SETTINGS)),
    isDisabled$: of(false),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_SETTINGS;
    },
  };

  public tabsTop: Tab[] = [this.myAddonsTab, this.getAddonsTab, this.newsTab];

  public tabsBottom: Tab[] = [this.settingsTab];

  public constructor(
    public electronService: ElectronService,
    public sessionService: SessionService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {}

  public ngOnInit(): void {}

  public onClickTab(tabIndex: number): void {
    this.sessionService.selectedHomeTab = tabIndex;
  }
}
