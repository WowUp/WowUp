import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

@Pipe({ name: "trustHtml" })
export class TrustHtmlPipe implements PipeTransform {
  public constructor(private _sanitizer: DomSanitizer) {}

  public transform(value: string): SafeHtml {
    return this._sanitizer.bypassSecurityTrustHtml(value);
  }
}
