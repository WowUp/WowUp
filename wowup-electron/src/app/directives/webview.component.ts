import { Directive, ElementRef, Input, OnDestroy, OnInit } from "@angular/core";
import { nanoid } from "nanoid";
import { AdPageOptions } from "../../common/wowup/models";
import { FileService } from "../services/files/file.service";

@Directive({
  selector: "app-webview",
})
export class WebviewComponent implements OnInit, OnDestroy {
  @Input("options") options: AdPageOptions;

  private _tag: Electron.WebviewTag;
  private _id: string = nanoid();
  private _element: ElementRef;

  constructor(el: ElementRef, private _fileService: FileService) {
    this._element = el;
  }

  ngOnInit(): void {
    this.initWebview(this._element).catch((e) => console.error(e));
  }

  ngOnDestroy(): void {
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
    const userAgent = this.options.userAgent ? `useragent="${this.options.userAgent}"` : "";
    const preload = this.options.preloadFilePath
      ? `preload="${await this._fileService.getAssetFilePath(this.options.preloadFilePath)}"`
      : "";

    const placeholder = document.createElement("div");
    placeholder.innerHTML = `
    <webview id="${this._id}" 
      src="${this.options.pageUrl}" 
      ${pageReferrer}
      style="width: 100%; height: 100%;"
      nodeintegration​="false"
      nodeintegrationinsubframes​="false"
      plugins​="false"
      allowpopups​="false"
      ${preload}
      ${userAgent}>
    </webview>`;

    this._tag = placeholder.firstElementChild as Electron.WebviewTag;

    element.nativeElement.appendChild(this._tag);
    this._tag.addEventListener("dom-ready", this.onWebviewReady);
  }

  private onWebviewReady = () => {
    console.debug("onWebviewReady", this._tag);
    this._tag.removeEventListener("dom-ready", this.onWebviewReady);
    // this._tag.openDevTools();
  };
}
