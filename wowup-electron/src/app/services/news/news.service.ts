import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
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
  public url =
    "https://www.warcrafttavern.com/?call_custom_simple_rss=1&csrp_post_type=wow-classic-news,tbc-classic-news,retail-news&csrp_thumbnail_size=full";

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
      id: item.getElementsByTagName("dc:identifier")[0].textContent,
      title: item.getElementsByTagName("title")[0].textContent,
      description: item.getElementsByTagName("description")[0].textContent,
      link: item.getElementsByTagName("link")[0].textContent,
      publishedAt: new Date(item.getElementsByTagName("pubDate")[0].textContent),
      publishedBy: item.getElementsByTagName("dc:creator")[0].textContent,
      thumbnail: item.getElementsByTagName("media:content")[0].getAttribute("url"),
    };
  }
}

@Injectable({
  providedIn: "root",
})
export class NewsService {
  private _newsFeeds: NewsFeed[] = [new WowTavernFeed(this._networkService)];

  public newsItems$ = new BehaviorSubject<NewsItem[]>([]);

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

    this.newsItems$.next(newsItems);
    return newsItems;
  }
}
