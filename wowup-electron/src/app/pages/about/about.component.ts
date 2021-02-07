import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import { from } from "rxjs";
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

  public changeLogs: ChangeLog[] = ChangeLogJson.ChangeLogs;
  public versionNumber = from(this.electronService.getVersionNumber());

  constructor(public wowUpService: WowUpService, public electronService: ElectronService) {}

  ngOnInit(): void {}

  formatChanges(changeLog: ChangeLog): string {
    return changeLog.changes.join("\n");
  }
}
