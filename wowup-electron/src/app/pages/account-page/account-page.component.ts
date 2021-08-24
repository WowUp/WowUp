import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-account-page",
  templateUrl: "./account-page.component.html",
  styleUrls: ["./account-page.component.scss"],
})
export class AccountPageComponent {
  public displayName$ = this.sessionService.wowUpAccount$.pipe(map((account) => account?.displayName ?? ""));

  public constructor(
    public electronService: ElectronService,
    public sessionService: SessionService,
    private _wowUpService: WowUpService
  ) {}

  public logout(): void {
    this.sessionService.clearWowUpAuthToken();
  }

  public testLogin(): void {
    this._wowUpService.login();
    // this.electronService._customProtocolSrc.next(
    //   "wowup://login/desktop/zzzzzzzzzzzzzzzzzzzzzzzz"
    // );
  }
}
