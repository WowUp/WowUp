import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild } from "@angular/core";
import { nanoid } from "nanoid";
import { filter, Subject, takeUntil } from "rxjs";
import { AdPageOptions } from "../../../../common/wowup/models";
import { ElectronService } from "../../../services/electron/electron.service";
import { FileService } from "../../../services/files/file.service";
import { LinkService } from "../../../services/links/link.service";
import { SessionService } from "../../../services/session/session.service";
import { UiMessageService } from "../../../services/ui-message/ui-message.service";

@Component({
  selector: "app-webview",
  templateUrl: "./webview.component.html",
  styleUrls: ["./webview.component.scss"],
})
export class WebViewComponent implements OnDestroy, AfterViewInit {
  @Input("options") public options: AdPageOptions;

  @ViewChild("webviewContainer", { read: ElementRef }) public webviewContainer!: ElementRef;

  private readonly destroy$: Subject<boolean> = new Subject<boolean>();

  private _tag: Electron.WebviewTag;
  private _id: string = nanoid();
  private _webviewReady = false;

  public constructor(
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _linkService: LinkService,
    private _sessionService: SessionService,
    private _uiMessageService: UiMessageService,
    private _ngZone: NgZone
  ) {}

  public ngAfterViewInit(): void {
    this.initWebview(this.webviewContainer).catch((e) => console.error(e));
    this._electronService.on("webview-new-window", this.onWebviewNewWindow);
    this._uiMessageService.message$
      .pipe(
        takeUntil(this.destroy$),
        filter((msg) => msg.action === "ad-frame-reload")
      )
      .subscribe(() => {
        if (this._webviewReady) {
          this._tag?.reloadIgnoringCache();
        }
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.complete();

    this._electronService.off("webview-new-window", this.onWebviewNewWindow);

    // Clean up the webview element
    if (this._tag) {
      if (this._tag.isDevToolsOpened()) {
        this._tag.closeDevTools();
      }
      this._tag = undefined;
    }

    this.webviewContainer.nativeElement.innerHTML = 0;
  }

  private async initWebview(element: ElementRef) {
    // const pageReferrer = this.options.referrer ? `httpreferrer="${this.options.referrer}"` : "";
    // const userAgent = this.options.userAgent ?? "";
    const preloadPath = `file://${await this._fileService.getAssetFilePath(this.options.preloadFilePath)}`;
    // const preload = this.options.preloadFilePath ? `preload="${preloadPath}"` : "";
    const partition = this.options.partition ?? "memcache";

    console.debug("initWebview", this.options);

    const placeholder = document.createElement("div");
    placeholder.style.width = "100%";
    placeholder.style.height = "100%";

    /* eslint-disable no-irregular-whitespace */
    const webview: Electron.WebviewTag = document.createElement("webview");
    webview.id = this._id;
    webview.src = this.options.pageUrl;
    webview.setAttribute("style", "width: 100%; height: 100%;");
    webview.nodeintegration = false;
    webview.nodeintegrationinsubframes = false;
    webview.plugins = false;
    webview.allowpopups = true;
    webview.partition = partition;
    webview.preload = preloadPath;
    // webview.useragent = userAgent;

    // placeholder.innerHTML = `
    // <webview id="${this._id}"
    //   ${pageReferrer}
    //   style="width: 100%; height: 100%;"
    //   nodeintegration​="false"
    //   nodeintegrationinsubframes​="false"
    //   plugins​="false"
    //   allowpopups
    //   partition="${partition}"
    //   ${preload}
    //   useragent="${userAgent}">
    // </webview>`;
    /* eslint-enable no-irregular-whitespace */

    this._tag = webview; // placeholder.firstElementChild as Electron.WebviewTag;

    this._tag.addEventListener("error", (evt) => {
      console.error("ERROR", evt);
    });

    this._tag.addEventListener("did-fail-load", (evt) => {
      console.error("did-fail-load", evt);
    });

    this._tag.addEventListener("dom-ready", this.onWebviewReady);

    placeholder.appendChild(webview);
    element.nativeElement.appendChild(placeholder);
  }

  private onWebviewReady = () => {
    console.debug("onWebviewReady", this._tag);

    this._webviewReady = true;

    this._sessionService.debugAdFrame$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (!this._tag.isDevToolsOpened()) {
        this._tag?.openDevTools();
      }
    });

    this._tag.removeEventListener("dom-ready", this.onWebviewReady);
    // this._tag.openDevTools();
  };

  private onWebviewNewWindow = (evt, details: Electron.HandlerDetails) => {
    console.debug(`webview-new-window`, details);
    this._ngZone.run(() => {
      this._linkService.confirmLinkNavigation(details.url).subscribe();
    });
  };
}
