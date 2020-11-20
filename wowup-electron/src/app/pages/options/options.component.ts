import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import {
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
} from "common/constants";
import { ElectronService } from "../../services";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent implements OnInit {
  @Input("tabIndex") tabIndex: number;

  public optionTabIndex = 0;

  constructor(public wowUpService: WowUpService, public electronService: ElectronService) {}

  ngOnInit(): void {}
  
}
