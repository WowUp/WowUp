import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams, IAfterGuiAttachedParams } from "ag-grid-community";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";

@Component({
  selector: "app-get-addon-status-column",
  templateUrl: "./get-addon-status-column.component.html",
  styleUrls: ["./get-addon-status-column.component.scss"],
})
export class GetAddonStatusColumnComponent implements AgRendererComponent {
  @Input() public addonSearchResult!: AddonSearchResult;

  @Output() public onInstallViewUpdated: EventEmitter<boolean> = new EventEmitter();

  public refresh(params: ICellRendererParams): boolean {
    return false;
  }

  public agInit(params: ICellRendererParams): void {
    this.addonSearchResult = params.data.searchResult;
  }

  public afterGuiAttached?(params?: IAfterGuiAttachedParams): void {}

  public onInstallButtonUpdated(): void {
    this.onInstallViewUpdated.emit(true);
  }
}
