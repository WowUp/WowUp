import { Directive, ElementRef, Input, OnDestroy, OnInit } from "@angular/core";
import { nanoid } from "nanoid";
import { Subject, takeUntil } from "rxjs";
import { AdPageOptions } from "../../common/wowup/models";
import { ElectronService } from "../services";
import { FileService } from "../services/files/file.service";
import { LinkService } from "../services/links/link.service";
import { SessionService } from "../services/session/session.service";

@Directive({
  selector: "app-webview",
})
export class WebviewComponent implements OnInit, OnDestroy {
  @Input("options") public options: AdPageOptions;

  private readonly destroy$: Subject<boolean> = new Subject<boolean>();
  private _tag: Electron.WebviewTag;
  private _id: string = nanoid();
  private _element: ElementRef;

  public constructor(
    el: ElementRef,
    private _fileService: FileService,
    private _linkService: LinkService,
    private _sessionService: SessionService,
    private _electronService: ElectronService
  ) {
    this._element = el;
  }

  public ngOnInit(): void {
    this.initWebview(this._element).catch((e) => console.error(e));
    this._electronService.on("webview-new-window", this.onWebviewNewWindow);
  }

  public ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.unsubscribe();

    this._electronService.off("webview-new-window", this.onWebviewNewWindow);

    // Clean up the webview element
    if (this._tag) {
      if (this._tag.isDevToolsOpened()) {
        this._tag.closeDevTools();
      }
      this._tag = undefined;
    }

    this._element.nativeElement.innerHTML = 0;
  }

  private async initWebview(element: ElementRef) {
    const pageReferrer = this.options.referrer ? `httpreferrer="${this.options.referrer}"` : "";
    const userAgent = this.options.userAgent ?? "";
    const preload = this.options.preloadFilePath
      ? `preload="${await this._fileService.getAssetFilePath(this.options.preloadFilePath)}"`
      : "";
    const partition = this.options.partition ?? "memcache";

    console.debug("initWebview", this.options);

    const placeholder = document.createElement("div");

    /* eslint-disable no-irregular-whitespace */
    placeholder.innerHTML = `
    <webview id="${this._id}" 
      src="${this.options.pageUrl}" 
      ${pageReferrer}
      style="width: 100%; height: 100%;"
      nodeintegration​="false"
      nodeintegrationinsubframes​="false"
      plugins​="false"
      allowpopups​="false"
      partition="${partition}"
      ${preload}
      useragent="${userAgent}">
    </webview>`;
    /* eslint-enable no-irregular-whitespace */

    this._tag = placeholder.firstElementChild as Electron.WebviewTag;

    element.nativeElement.appendChild(this._tag);
    this._tag.addEventListener("dom-ready", this.onWebviewReady);
  }

  private onWebviewReady = () => {
    console.debug("onWebviewReady", this._tag);

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
    this._linkService.confirmLinkNavigation(details.url).subscribe();
  };
}
