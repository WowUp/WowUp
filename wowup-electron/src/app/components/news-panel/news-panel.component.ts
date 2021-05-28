import { Component, OnInit } from "@angular/core";
import { ElectronService } from "app/services";
import { DialogFactory } from "app/services/dialog/dialog.factory";
import { BehaviorSubject, from, of } from "rxjs";
import { catchError, first, switchMap } from "rxjs/operators";
import { NewsItem, NewsService } from "../../services/news/news.service";

@Component({
  selector: "app-news-panel",
  templateUrl: "./news-panel.component.html",
  styleUrls: ["./news-panel.component.scss"],
})
export class NewsPanelComponent implements OnInit {
  public constructor(
    public newsService: NewsService,
    public electronService: ElectronService,
    private _dialogFactory: DialogFactory,
    private _electronService: ElectronService
  ) {}

  public ngOnInit(): void {
    from(this.newsService.loadFeeds()).pipe(first()).subscribe();
  }

  public onClickItem(item: NewsItem): void {
    this._dialogFactory
      .confirmLinkNavigation(item.link)
      .pipe(
        switchMap((confirmed) => {
          return confirmed ? from(this._electronService.openExternal(item.link)) : of(undefined);
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();
  }
}
