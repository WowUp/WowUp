import { map } from "rxjs/operators";

import { Component, OnInit } from "@angular/core";

import { SessionService } from "../../services/session/session.service";
import {
  TAB_INDEX_ABOUT,
  TAB_INDEX_GET_ADDONS,
  TAB_INDEX_MY_ADDONS,
  TAB_INDEX_NEWS,
  TAB_INDEX_SETTINGS,
} from "../../../common/constants";
import { Observable, of } from "rxjs";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";

interface Tab {
  tooltipKey: string;
  icon: string;
  badge?: boolean;
  isSelected$: Observable<boolean>;
  isDisabled$: Observable<boolean>;
  onClick: (tab: Tab) => void;
}

@Component({
  selector: "app-vertical-tabs",
  templateUrl: "./vertical-tabs.component.html",
  styleUrls: ["./vertical-tabs.component.scss"],
})
export class VerticalTabsComponent implements OnInit {
  private myAddonsTab: Tab = {
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
    tooltipKey: "PAGES.HOME.GET_ADDONS_TAB_TITLE",
    icon: "fas:search",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_GET_ADDONS)),
    isDisabled$: this._warcraftInstallationService.wowInstallations$.pipe(
      map((installations) => installations.length === 0)
    ),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_GET_ADDONS;
    },
  };

  private aboutTab: Tab = {
    tooltipKey: "PAGES.HOME.ABOUT_TAB_TITLE",
    icon: "fas:info-circle",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_ABOUT)),
    isDisabled$: of(false),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_ABOUT;
    },
  };

  private newsTab: Tab = {
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
    tooltipKey: "PAGES.HOME.OPTIONS_TAB_TITLE",
    icon: "fas:cog",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_SETTINGS)),
    isDisabled$: of(false),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_SETTINGS;
    },
  };

  public tabsTop: Tab[] = [this.myAddonsTab, this.getAddonsTab, this.aboutTab, this.newsTab];

  public tabsBottom: Tab[] = [this.settingsTab];

  public constructor(
    public sessionService: SessionService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {}

  public ngOnInit(): void {}
}
