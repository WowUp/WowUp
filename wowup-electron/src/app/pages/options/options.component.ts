import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import { IPC_OW_IS_CMP_REQUIRED } from "../../../common/constants";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { AppConfig } from "../../../environments/environment";
// import { IPC_OW_IS_CMP_REQUIRED, IPC_OW_OPEN_CMP } from "../../../../common/constants";

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent implements OnInit {
  @Input("tabIndex") public tabIndex!: number;

  public optionTabIndex = 0;
  public isCMPRequired = false;
  public isCurseForge = AppConfig.curseforge.enabled;

  public constructor(
    public wowUpService: WowUpService,
    public sessionService: SessionService,
    public electronService: ElectronService,
  ) {}

  public ngOnInit(): void {
    if (this.isCurseForge) {
      this.electronService
        .invoke<boolean>(IPC_OW_IS_CMP_REQUIRED)
        .then((cmpRequired) => {
          this.isCMPRequired = cmpRequired;
        })
        .catch((e) => console.error("IPC_OW_IS_CMP_REQUIRED failed", e));
    }
  }
}
