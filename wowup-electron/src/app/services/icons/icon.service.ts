import { Injectable } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { DomSanitizer } from "@angular/platform-browser";

@Injectable({
  providedIn: "root",
})
export class IconService {
  constructor(
    private _matIconRegistry: MatIconRegistry,
    private _sanitizer: DomSanitizer
  ) {}

  async addSvg(icon: IconDefinition) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.icon[0]} ${icon.icon[1]}"><path d="${icon.icon[4]}" /></svg>`;

    this._matIconRegistry.addSvgIconLiteralInNamespace(
      icon.prefix,
      icon.iconName,
      this._sanitizer.bypassSecurityTrustHtml(svg)
    );
  }
}
