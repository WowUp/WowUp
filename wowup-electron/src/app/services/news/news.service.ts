import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { AppConfig } from "../../../environments/environment";
import { NetworkService } from "../network/network.service";

declare type NewsFeedType = "xml";

interface NewsFeed {
  url: string;
  type: NewsFeedType;
  process: () => Promise<NewsItem[]>;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  description: string;
  publishedAt: Date;
  publishedBy: string;
  thumbnail: string;
}

class WowTavernFeed implements NewsFeed {
  public url = AppConfig.warcraftTavernNewsFeedUrl;

  public type: NewsFeedType = "xml";

  public constructor(public networkService: NetworkService) {}

  public async process(): Promise<NewsItem[]> {
    const newsItems: NewsItem[] = [];

    const xmlStr = await this.networkService.getText(this.url);
    const parser = new DOMParser();
    const dom = parser.parseFromString(xmlStr, "application/xml");
    const channels = dom.getElementsByTagName("channel");

    for (const channel of Array.from(channels)) {
      for (const item of Array.from(channel.getElementsByTagName("item"))) {
        newsItems.push(this.getNewsItem(item));
      }
    }

    return newsItems;
  }

  private getNewsItem(item: Element): NewsItem {
    return {
      id: this.getText(item, "dc:identifier"),
      title: this.getText(item, "title"),
      description: this.getText(item, "description"),
      link: this.getText(item, "link"),
      publishedAt: new Date(this.getText(item, "pubDate")),
      publishedBy: this.getText(item, "dc:creator"),
      thumbnail: this.getUrl(item, "media:content"),
    };
  }

  private getText(item: Element, name: string): string {
    return item.getElementsByTagName(name)[0]?.textContent ?? "";
  }

  private getUrl(item: Element, name: string): string {
    return item.getElementsByTagName(name)[0]?.getAttribute("url") ?? "";
  }
}

@Injectable({
  providedIn: "root",
})
export class NewsService {
  private _lastFetchedAt = 0;
  private _newsFeeds: NewsFeed[] = [new WowTavernFeed(this._networkService)];

  public newsItems$ = new BehaviorSubject<NewsItem[]>([]);

  public get lastFetchedAt(): number {
    return this._lastFetchedAt;
  }

  public constructor(private _networkService: NetworkService) {}

  public async loadFeeds(): Promise<NewsItem[]> {
    let newsItems: NewsItem[] = [];
    for (const feed of this._newsFeeds) {
      try {
        const feedItems = await feed.process();
        newsItems = newsItems.concat(...feedItems);
      } catch (e) {
        console.error(e);
      }
    }

    this._lastFetchedAt = Date.now();
    this.newsItems$.next(newsItems);
    return newsItems;
  }
}
