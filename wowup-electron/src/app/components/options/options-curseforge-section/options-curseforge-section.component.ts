import { Component } from "@angular/core";
import { IPC_OW_OPEN_CMP } from "../../../../common/constants";
import { ElectronService } from "../../../services";

@Component({
  selector: "app-options-curseforge-section",
  templateUrl: "./options-curseforge-section.component.html",
  styleUrls: ["./options-curseforge-section.component.scss"],
})
export class OptionsCurseforgeSectionComponent {
  public constructor(private _electronService: ElectronService) {}

  public onClickManage(evt: MouseEvent): void {
    evt.preventDefault();

    this._electronService.invoke(IPC_OW_OPEN_CMP).catch((e) => console.error("onClickManage failed", e));
  }
}
