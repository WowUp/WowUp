import { BehaviorSubject, Observable, of, Subject } from "rxjs";
import { map, takeUntil } from "rxjs/operators";

import { Component, OnDestroy, OnInit } from "@angular/core";

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
import { AdPageOptions } from "../../../../common/wowup/models";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { MatDialog } from "@angular/material/dialog";
import { AlertDialogComponent } from "../alert-dialog/alert-dialog.component";
import { TranslateService } from "@ngx-translate/core";

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
  selector: "app-vertical-tabs",
  templateUrl: "./vertical-tabs.component.html",
  styleUrls: ["./vertical-tabs.component.scss"],
})
export class VerticalTabsComponent implements OnInit, OnDestroy {
  private readonly destroy$: Subject<boolean> = new Subject<boolean>();

  public wowUpWebsiteUrl = AppConfig.wowUpWebsiteUrl;
  public TAB_INDEX_ACCOUNT = TAB_INDEX_ABOUT;
  public FEATURE_ACCOUNTS_ENABLED = FEATURE_ACCOUNTS_ENABLED;
  public adPageParams$ = new BehaviorSubject<AdPageOptions[]>([]);

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
    icon: "fas:cog",
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
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _addonProviderService: AddonProviderFactory,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {
    this.sessionService.adSpace$.pipe(takeUntil(this.destroy$)).subscribe((enabled) => {
      if (enabled) {
        const providers = this._addonProviderService.getAdRequiredProviders();
        const providerParams = providers
          .map((provider) => provider.getAdPageParams())
          .filter((param) => param !== undefined);

        console.debug("providerParams", providerParams);

        this.adPageParams$.next(providerParams);
      } else {
        this.adPageParams$.next([]);
      }
    });
  }

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.unsubscribe();
  }

  public onClickTab(tabIndex: number): void {
    this.sessionService.selectedHomeTab = tabIndex;
  }

  public onClickAdExplainer(): void {
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      disableClose: true,
      data: {
        title: this._translateService.instant("Why am I seeing this ad?"),
        message: this._translateService.instant(
          `In order to use wago.io as an addon provider and support their authors for their hard work on your favorite addons we are required to show this advertisement.\n\nIf you do not want to see this ad, you can always disable wago.io as a provider in the options tab.`
        ),
      },
    });
  }
}
