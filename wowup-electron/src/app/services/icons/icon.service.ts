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
  faExclamation,
  faExclamationTriangle,
  faCode,
  faCoins,
  faCompressArrowsAlt,
  faPencilAlt,
  faArrowDown,
  faCheckCircle,
  faDiceD6,
  faSearch,
  faNewspaper,
  faCog,
  faAngleUp,
  faAngleDown,
  faChevronRight,
  faUserCircle,
  faEllipsisV,
  faCopy,
  faTrash,
  faHistory,
  faMinimize,
  faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import {
  faQuestionCircle,
  faClock,
  faCheckCircle as farCheckCircle,
  faCaretSquareRight,
  faCaretSquareLeft,
} from "@fortawesome/free-regular-svg-icons";
import { faDiscord, faGithub, faPatreon } from "@fortawesome/free-brands-svg-icons";

@Injectable({
  providedIn: "root",
})
export class IconService {
  public constructor(private _matIconRegistry: MatIconRegistry, private _sanitizer: DomSanitizer) {
    this.addSvg(faAngleDoubleDown);
    this.addSvg(faArrowUp);
    this.addSvg(faArrowDown);
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
    this.addSvg(faExclamationTriangle);
    this.addSvg(faCode);
    this.addSvg(faPatreon);
    this.addSvg(faCoins);
    this.addSvg(faCompressArrowsAlt);
    this.addSvg(faPencilAlt);
    this.addSvg(faCheckCircle);
    this.addSvg(faDiceD6);
    this.addSvg(faSearch);
    this.addSvg(faInfoCircle);
    this.addSvg(faNewspaper);
    this.addSvg(faCog);
    this.addSvg(faAngleUp);
    this.addSvg(faAngleDown);
    this.addSvg(faChevronRight);
    this.addSvg(faUserCircle);
    this.addSvg(faEllipsisV);
    this.addSvg(faCopy);
    this.addSvg(farCheckCircle);
    this.addSvg(faExclamation);
    this.addSvg(faTrash);
    this.addSvg(faHistory);
    this.addSvg(faCaretSquareRight);
    this.addSvg(faCaretSquareLeft);
    this.addSvg(faMinimize);
    this.addSvg(faUpRightFromSquare);
  }

  private addSvg(icon: IconDefinition): void {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.icon[0]} ${
      icon.icon[1]
    }"><path d="${icon.icon[4].toString()}" /></svg>`;

    this._matIconRegistry.addSvgIconLiteralInNamespace(
      icon.prefix,
      icon.iconName,
      this._sanitizer.bypassSecurityTrustHtml(svg)
    );
  }
}
