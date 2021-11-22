import { Directive, ElementRef, OnInit } from "@angular/core";
import { nanoid } from "nanoid";
import { FileService } from "../services/files/file.service";

@Directive({
  selector: "app-webview",
})
export class WebviewComponent implements OnInit {
  // TODO add input URL
  // TODO add input config object

  private _tag: Electron.WebviewTag;
  private _id: string = nanoid();
  private _element: ElementRef;

  constructor(el: ElementRef, private _fileService: FileService) {
    this._element = el;
  }

  ngOnInit(): void {
    this.initWebview(this._element).catch((e) => console.error(e));
  }

  private async initWebview(element: ElementRef) {
    // ad container requires a 'normal' UA
    const userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36`;
    const preloadPath = await this._fileService.getAssetFilePath("preload/wago.js");
    console.log("preloadPath", preloadPath);

    const placeholder = document.createElement("div");
    placeholder.innerHTML = `
    <webview id="${this._id}" 
      src="https://addons.wago.io/wowup_ad" 
      httpreferrer="https://wago.io"
      style="width: 100%; height: 100%;"
      nodeintegration​="false"
      nodeintegrationinsubframes​="false"
      plugins​="false"
      allowpopups​="false"
      preload="${preloadPath}"
      useragent="${userAgent}">
    </webview>`;

    this._tag = placeholder.firstElementChild as Electron.WebviewTag;

    element.nativeElement.appendChild(this._tag);
    this._tag.addEventListener("dom-ready", this.onWebviewReady);
  }

  private onWebviewReady = () => {
    console.debug("onWebviewReady", this._tag);
    this._tag.removeEventListener("dom-ready", this.onWebviewReady);
    this._tag.openDevTools();
  };
}
