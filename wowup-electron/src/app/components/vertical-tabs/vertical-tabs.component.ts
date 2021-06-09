import { Component, OnInit } from "@angular/core";
import { SessionService } from "app/services/session/session.service";
import { of } from "rxjs";
import { map } from "rxjs/operators";

@Component({
  selector: "app-vertical-tabs",
  templateUrl: "./vertical-tabs.component.html",
  styleUrls: ["./vertical-tabs.component.scss"],
})
export class VerticalTabsComponent implements OnInit {
  public constructor(public sessionService: SessionService) {}

  public tabsTop = [
    {
      tooltipKey: "PAGES.HOME.MY_ADDONS_TAB_TITLE",
      icon: "fas:dice-d6",
      isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === 0)),
      onClick: () => {
        this.sessionService.selectedHomeTab = 0;
      },
    },
    {
      tooltipKey: "PAGES.HOME.GET_ADDONS_TAB_TITLE",
      icon: "fas:search",
      isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === 1)),
      onClick: () => {
        this.sessionService.selectedHomeTab = 1;
      },
    },
    {
      tooltipKey: "PAGES.HOME.ABOUT_TAB_TITLE",
      icon: "fas:info-circle",
      isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === 2)),
      onClick: () => {
        this.sessionService.selectedHomeTab = 2;
      },
    },
    {
      tooltipKey: "PAGES.HOME.NEWS_TAB_TITLE",
      icon: "fas:newspaper",
      badge: true,
      isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === 3)),
      onClick: () => {
        this.sessionService.selectedHomeTab = 3;
      },
    },
  ];

  /*
 
  */
  public tabsBottom = [
    {
      tooltipKey: "PAGES.HOME.OPTIONS_TAB_TITLE",
      icon: "fas:cog",
      isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === 4)),
      onClick: () => {
        this.sessionService.selectedHomeTab = 4;
      },
    },
  ];

  public ngOnInit(): void {}
}
