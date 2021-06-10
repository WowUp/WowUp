import * as _ from "lodash";
import { from, of } from "rxjs";
import { catchError, first, switchMap } from "rxjs/operators";

import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { ChangeLog } from "../../models/wowup/change-log";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { ElectronService } from "../../services/electron/electron.service";
import { PatchNotesService } from "../../services/wowup/patch-notes.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { formatDynamicLinks } from "../../utils/dom.utils";

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
    private _dialogFactory: DialogFactory,
    private _wowupService: WowUpService
  ) {
    this.changeLog = _.first(this._patchNotesService.changeLogs) ?? { Version: "" };
  }

  public ngOnInit(): void {}

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.descriptionContainer?.nativeElement;
    formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    this._dialogFactory
      .confirmLinkNavigation(element.href)
      .pipe(
        switchMap((confirmed) => {
          return confirmed ? from(this._wowupService.openExternalLink(element.href)) : of(undefined);
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();

    return false;
  };
}
