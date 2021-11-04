import * as _ from "lodash";
import { from } from "rxjs";
import { first, switchMap } from "rxjs/operators";

import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { ChangeLog } from "../../../models/wowup/change-log";
import { ElectronService } from "../../../services/electron/electron.service";
import { PatchNotesService } from "../../../services/wowup/patch-notes.service";
import { formatDynamicLinks } from "../../../utils/dom.utils";
import { LinkService } from "../../../services/links/link.service";

@Component({
  selector: "app-patch-notes-dialog",
  templateUrl: "./patch-notes-dialog.component.html",
  styleUrls: ["./patch-notes-dialog.component.scss"],
})
export class PatchNotesDialogComponent implements OnInit, AfterViewChecked {
  @ViewChild("descriptionContainer", { read: ElementRef }) public descriptionContainer!: ElementRef;

  public title = from(this._electronService.getVersionNumber()).pipe(
    first(),
    switchMap((versionNumber) => this._translateService.get("DIALOGS.NEW_VERSION_POPUP.TITLE", { versionNumber }))
  );

  public changeLog: ChangeLog;

  public constructor(
    private _translateService: TranslateService,
    private _electronService: ElectronService,
    private _patchNotesService: PatchNotesService,
    private _linkService: LinkService
  ) {
    this.changeLog = _.first(this._patchNotesService.changeLogs) ?? { Version: "" };
  }

  public ngOnInit(): void {}

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.descriptionContainer?.nativeElement;
    formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    this._linkService.confirmLinkNavigation(element.href).subscribe();

    return false;
  };
}
