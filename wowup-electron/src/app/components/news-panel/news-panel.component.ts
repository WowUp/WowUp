import { from, of, Subscription } from "rxjs";
import { catchError, delay, first, map, switchMap } from "rxjs/operators";

import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { AppConfig } from "../../../environments/environment";
import { ElectronService } from "../../services/electron/electron.service";
import { LinkService } from "../../services/links/link.service";
import { NewsItem, NewsService } from "../../services/news/news.service";
import { SessionService } from "../../services/session/session.service";
import { SnackbarService } from "../../services/snackbar/snackbar.service";

@Component({
  selector: "app-news-panel",
  templateUrl: "./news-panel.component.html",
  styleUrls: ["./news-panel.component.scss"],
})
export class NewsPanelComponent implements OnInit, OnDestroy {
  @Input("tabIndex") public tabIndex!: number;

  public isBusy = false;
  public lastUpdated = 0;

  private _isLazyLoaded = false;
  private _isSelectedTab = false;
  private _subscriptions: Subscription[] = [];

  public constructor(
    public newsService: NewsService,
    public electronService: ElectronService,
    private _sessionService: SessionService,
    private _translateService: TranslateService,
    private _linkService: LinkService,
    private _snackbarService: SnackbarService
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
        delay(500),
        switchMap(() => from(this.newsService.loadFeeds())),
        map(() => {
          this.lastUpdated = Date.now();
        }),
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
    this._linkService.confirmLinkNavigation(item.link).subscribe();
  }

  public onClickLink(item: NewsItem, evt: MouseEvent): void {
    evt.preventDefault();
    evt.stopPropagation();

    this._snackbarService.showSuccessSnackbar("PAGES.NEWS.NEWS_LINK_COPY_TOAST", {
      timeout: 2000,
    });
  }

  private lazyLoad(): void {
    if (!this.shouldReloadFeeds() && this._isLazyLoaded) {
      this.setPageContextText(this.newsService.newsItems$.value.length);
      return;
    }
    this.onClickRefresh();
    this._isLazyLoaded = true;
  }

  private setPageContextLoading() {
    const text: string = this._translateService.instant("COMMON.PROGRESS_SPINNER.LOADING");
    this._sessionService.setContextText(this.tabIndex, text);
  }

  private setPageContextText(rowCount: number) {
    const contextStr: string =
      rowCount > 0 ? this._translateService.instant("PAGES.NEWS.PAGE_CONTEXT_FOOTER", { count: rowCount }) : "";

    this._sessionService.setContextText(this.tabIndex, contextStr);
  }

  private shouldReloadFeeds() {
    return (
      this.newsService.lastFetchedAt !== 0 &&
      Date.now() - this.newsService.lastFetchedAt >= AppConfig.newsRefreshIntervalMs
    );
  }
}
