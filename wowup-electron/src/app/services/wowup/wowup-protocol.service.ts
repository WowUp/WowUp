import { Injectable } from "@angular/core";
import { catchError, filter, first, of, switchMap, tap } from "rxjs";
import { APP_PROTOCOL_NAME } from "../../../common/constants";
import { InstallFromProtocolDialogComponent } from "../../components/addons/install-from-protocol-dialog/install-from-protocol-dialog.component";
import { getProtocol, getProtocolParts } from "../../utils/string.utils";
import { DialogFactory } from "../dialog/dialog.factory";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class WowUpProtocolService {
  public constructor(private _dialogFactory: DialogFactory, private _electronService: ElectronService) {}

  public initialize() {
    this._electronService.customProtocol$
      .pipe(
        tap((prt) => console.log("WowUpProtocolService", prt)),
        filter((prt) => getProtocol(prt) === APP_PROTOCOL_NAME && this.isInstallAction(prt)),
        switchMap((prt) => this.onInstallProtocol(prt)),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public isInstallAction(protocol: string) {
    return getProtocolParts(protocol)[0] === "install";
  }

  public onInstallProtocol(protocol: string) {
    console.log("onInstallProtocol", protocol);

    const dialog = this._dialogFactory.getDialog(InstallFromProtocolDialogComponent, {
      disableClose: true,
      data: {
        protocol,
      },
    });

    return dialog.afterClosed().pipe(first());
  }
}
