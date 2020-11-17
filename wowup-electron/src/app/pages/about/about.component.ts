import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import {
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
} from "common/constants";
import { remote } from "electron";
import * as ChangeLogJson from "../../../assets/changelog.json";
import { ChangeLog } from "../../models/wowup/change-log";
import { ElectronService } from "../../services";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-about",
  templateUrl: "./about.component.html",
  styleUrls: ["./about.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  @Input("tabIndex") tabIndex: number;

  public version = "";
  public changeLogs: ChangeLog[] = ChangeLogJson.ChangeLogs;

  constructor(private wowUpService: WowUpService, public electronService: ElectronService) {}

  ngOnInit(): void {
    this.version = remote.app.getVersion();
  }

  formatChanges(changeLog: ChangeLog): string {
    return changeLog.changes.join("\n");
  }

  getLogoPath() {
    switch (this.wowUpService.currentTheme) {
      case HORDE_THEME:
        return "assets/images/horde-1.png";
      case HORDE_LIGHT_THEME:
        return "assets/images/horde-dark-1.png";
      case ALLIANCE_THEME:
        return "assets/images/alliance-1.png";
      case ALLIANCE_LIGHT_THEME:
        return "assets/images/alliance-dark-1.png";
      case DEFAULT_LIGHT_THEME:
        return "assets/images/wowup-dark-1.png";
      case DEFAULT_THEME:
      default:
        return "assets/images/wowup-white-1.png";
    }
  }
}
