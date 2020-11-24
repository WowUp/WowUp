import { Injectable } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { DomSanitizer } from "@angular/platform-browser";

import {
  faAngleDoubleDown,
  faArrowUp,
  faSyncAlt,
  faTimes,
  faExternalLinkAlt,
  faPlay,
  faBug,
  faLink,
  faInfoCircle,
  faCodeBranch,
  faCaretDown,
} from "@fortawesome/free-solid-svg-icons";
import { faQuestionCircle, faClock } from "@fortawesome/free-regular-svg-icons";
import { faDiscord, faGithub } from "@fortawesome/free-brands-svg-icons";

@Injectable({
  providedIn: "root",
})
export class IconService {
  constructor(private _matIconRegistry: MatIconRegistry, private _sanitizer: DomSanitizer) {
    this.addSvg(faAngleDoubleDown);
    this.addSvg(faArrowUp);
    this.addSvg(faSyncAlt);
    this.addSvg(faTimes);
    this.addSvg(faExternalLinkAlt);
    this.addSvg(faQuestionCircle);
    this.addSvg(faPlay);
    this.addSvg(faClock);
    this.addSvg(faBug);
    this.addSvg(faLink);
    this.addSvg(faDiscord);
    this.addSvg(faGithub);
    this.addSvg(faInfoCircle);
    this.addSvg(faCodeBranch);
    this.addSvg(faCaretDown);
  }

  async addSvg(icon: IconDefinition) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.icon[0]} ${icon.icon[1]}"><path d="${icon.icon[4]}" /></svg>`;

    this._matIconRegistry.addSvgIconLiteralInNamespace(
      icon.prefix,
      icon.iconName,
      this._sanitizer.bypassSecurityTrustHtml(svg)
    );
  }
}
