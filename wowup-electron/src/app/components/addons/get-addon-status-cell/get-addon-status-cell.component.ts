import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";

import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AddonSearchResult } from "wowup-lib-core";

@Component({
  selector: "app-get-addon-status-cell",
  templateUrl: "./get-addon-status-cell.component.html",
  styleUrls: ["./get-addon-status-cell.component.scss"],
})
export class GetAddonStatusColumnComponent implements AgRendererComponent {
  @Input() public addonSearchResult!: AddonSearchResult;

  @Output() public onInstallViewUpdated: EventEmitter<boolean> = new EventEmitter();

  public refresh(): boolean {
    return false;
  }

  public agInit(params: ICellRendererParams): void {
    this.addonSearchResult = params.data.searchResult;
  }

  public afterGuiAttached?(): void {}

  public onInstallButtonUpdated(): void {
    this.onInstallViewUpdated.emit(true);
  }
}
