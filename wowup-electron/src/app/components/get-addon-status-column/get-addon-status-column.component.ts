import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";

@Component({
  selector: "app-get-addon-status-column",
  templateUrl: "./get-addon-status-column.component.html",
  styleUrls: ["./get-addon-status-column.component.scss"],
})
export class GetAddonStatusColumnComponent {
  @Input() addonSearchResult: AddonSearchResult;

  @Output() onInstallViewUpdated: EventEmitter<boolean> = new EventEmitter();

  onInstallButtonUpdated() {
    this.onInstallViewUpdated.emit(true);
  }
}
