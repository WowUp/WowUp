import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent {
  @Input("tabIndex") public tabIndex!: number;

  public optionTabIndex = 0;

  public constructor(
    public wowUpService: WowUpService,
    public sessionService: SessionService,
    public electronService: ElectronService
  ) {}
}
