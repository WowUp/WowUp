import { from, Observable, of } from "rxjs";
import { catchError } from "rxjs/operators";

import { Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import { WowClientType } from "../../../../common/warcraft/wow-client-type";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { WarcraftService } from "../../../services/warcraft/warcraft.service";
import { getEnumList } from "../../../utils/enum.utils";
import { AlertDialogComponent } from "../../common/alert-dialog/alert-dialog.component";
import { WowInstallation } from "../../../../common/warcraft/wow-installation";

@Component({
  selector: "app-options-wow-section",
  templateUrl: "./options-wow-section.component.html",
  styleUrls: ["./options-wow-section.component.scss"],
})
export class OptionsWowSectionComponent implements OnInit {
  public wowClientTypes: WowClientType[] = getEnumList(WowClientType).filter(
    (clientType) => clientType !== WowClientType.None
  ) as WowClientType[];

  public wowInstallations$: Observable<WowInstallation[]>;

  public constructor(
    private _dialog: MatDialog,
    private _warcraftService: WarcraftService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _translateService: TranslateService
  ) {
    this.wowInstallations$ = _warcraftInstallationService.wowInstallations$;
  }

  public ngOnInit(): void {}

  public onReScan = (): void => {
    this._warcraftInstallationService
      .importWowInstallations(this._warcraftInstallationService.blizzardAgentPath)
      .catch((e) => console.error(e));
  };

  public onAddNew(): void {
    from(this.addNewClient())
      .pipe(
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  }

  private async addNewClient() {
    const selectedPath = await this._warcraftInstallationService.selectWowClientPath();
    if (!selectedPath) {
      return;
    }

    console.log("dialogResult", selectedPath);

    const isWowApplication = await this._warcraftService.isWowApplication(selectedPath);

    if (!isWowApplication) {
      this.showInvalidWowApplication(selectedPath);
      return;
    }

    console.log("isWowApplication", isWowApplication);

    const wowInstallation = await this._warcraftInstallationService.createWowInstallationForPath(selectedPath);
    console.log("wowInstallation", wowInstallation);

    await this._warcraftInstallationService.addInstallation(wowInstallation);
  }

  private showInvalidWowApplication(selectedPath: string) {
    const dialogMessage: string = this._translateService.instant(
      "DIALOGS.SELECT_INSTALLATION.INVALID_INSTALLATION_PATH",
      {
        selectedPath,
      }
    );

    this.showError(dialogMessage);
  }

  private showError(message: string) {
    const title = this._translateService.instant("DIALOGS.ALERT.ERROR_TITLE");
    this._dialog.open(AlertDialogComponent, {
      data: {
        title,
        message,
      },
    });
  }
}
