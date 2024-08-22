import { Component } from "@angular/core";
import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";
import { SessionService } from "../../../services/session/session.service";
import { getWowMajorVersion } from "wowup-lib-core";

@Component({
  selector: "app-game-version-cell",
  templateUrl: "./game-version-cell.component.html",
  styleUrls: ["./game-version-cell.component.scss"],
})
export class GameVersionCellComponent implements AgRendererComponent {
  public displayValue = "";
  public title = "";

  public constructor(private _sessionService: SessionService) {}

  public agInit(params: ICellRendererParams<any, any, any>): void {
    this.title = this.getTooltip(params.value as string[]);

    this.displayValue = this.getVersionDisplay([...params.value] as string[]);
  }

  public refresh(): boolean {
    return false;
  }

  private getVersionDisplay(value: string[]): string {
    const wowInstall = this._sessionService.getSelectedWowInstallation();
    let displayVal = value[0] ?? "";

    if (wowInstall !== undefined) {
      const majorVersion = getWowMajorVersion(wowInstall.clientType);
      const versionMatch = value.find((x) => x.startsWith(majorVersion + "."));
      if (versionMatch !== undefined) {
        displayVal = versionMatch;
      }
    }

    if (value.length - 1 > 0) {
      displayVal += `, ${value.length - 1} +`;
    }

    return displayVal;
  }

  private getTooltip(value: string[]): string {
    return value.join(", ");
  }
}
