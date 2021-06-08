import { BehaviorSubject, from, of, Subscription } from "rxjs";
import { catchError, delay, first, map, switchMap } from "rxjs/operators";

import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { DialogFactory } from "../../services/dialog/dialog.factory";
import { ElectronService } from "../../services/electron/electron.service";
import { NewsItem, NewsService } from "../../services/news/news.service";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-news-panel",
  templateUrl: "./news-panel.component.html",
  styleUrls: ["./news-panel.component.scss"],
})
export class NewsPanelComponent implements OnInit, OnDestroy {
  @Input("tabIndex") public tabIndex: number;

  public isBusy = false;

  private _isSelectedTab = false;
  private _subscriptions: Subscription[] = [];

  public constructor(
    public newsService: NewsService,
    public electronService: ElectronService,
    private _dialogFactory: DialogFactory,
    private _wowupService: WowUpService,
    private _sessionService: SessionService,
    private _translateService: TranslateService
  ) {
    const homeTabSub = _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this._isSelectedTab = tabIndex === this.tabIndex;
      if (!this._isSelectedTab) {
        return;
      }

      this.lazyLoad();
    });

    const newsItemCountSub = this.newsService.newsItems$
      .pipe(map((items) => this.setPageContextText(items.length)))
      .subscribe();

    this._subscriptions.push(homeTabSub, newsItemCountSub);
  }

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
  }

  public onClickRefresh(): void {
    this.isBusy = true;
    this.setPageContextLoading();

    of(true)
      .pipe(
        first(),
        delay(1000),
        switchMap(() => from(this.newsService.loadFeeds())),
        catchError((err) => {
          console.error(err);
          return of(undefined);
        })
      )
      .subscribe(() => {
        this.isBusy = false;
      });
  }

  public onClickItem(item: NewsItem): void {
    this._dialogFactory
      .confirmLinkNavigation(item.link)
      .pipe(
        switchMap((confirmed) => {
          return confirmed ? from(this._wowupService.openExternalLink(item.link)) : of(undefined);
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();
  }

  private lazyLoad(): void {
    this.onClickRefresh();
  }

  private setPageContextLoading() {
    const text: string = this._translateService.instant("COMMON.PROGRESS_SPINNER.LOADING");
    this._sessionService.setContextText(this.tabIndex, text);
  }

  private setPageContextText(rowCount: number) {
    const contextStr =
      rowCount > 0 ? this._translateService.instant("PAGES.NEWS.PAGE_CONTEXT_FOOTER", { count: rowCount }) : "";

    this._sessionService.setContextText(this.tabIndex, contextStr);
  }
}
