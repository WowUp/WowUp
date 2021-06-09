import * as _ from "lodash";
import { from } from "rxjs";
import { first, switchMap } from "rxjs/operators";

import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { ChangeLog } from "../../models/wowup/change-log";
import { ElectronService } from "../../services/electron/electron.service";
import { PatchNotesService } from "../../services/wowup/patch-notes.service";

@Component({
  selector: "app-patch-notes-dialog",
  templateUrl: "./patch-notes-dialog.component.html",
  styleUrls: ["./patch-notes-dialog.component.scss"],
})
export class PatchNotesDialogComponent implements OnInit {
  public title = from(this._electronService.getVersionNumber()).pipe(
    first(),
    switchMap((versionNumber) => this._translateService.get("DIALOGS.NEW_VERSION_POPUP.TITLE", { versionNumber }))
  );

  public changeLog: ChangeLog;

  public constructor(
    private _translateService: TranslateService,
    private _electronService: ElectronService,
    private _patchNotesService: PatchNotesService
  ) {
    this.changeLog = _.first(this._patchNotesService.changeLogs) ?? { Version: "" };
  }

  public ngOnInit(): void {}
}
