import { Component } from "@angular/core";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";

@Component({
  selector: "app-account-page",
  templateUrl: "./account-page.component.html",
  styleUrls: ["./account-page.component.scss"],
})
export class AccountPageComponent {
  public constructor(public electronService: ElectronService, public sessionService: SessionService) {}

  public logout(): void {
    this.sessionService.clearWowUpAuthToken();
  }

  public testLogin(): void {
    this.electronService._customProtocolSrc.next(
      "wowup://login/desktop/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
    );
  }
}
