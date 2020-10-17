import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { GetAddonListItem } from "app/business-objects/get-addon-list-item";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";

@Component({
  selector: "app-potential-addon-table-column",
  templateUrl: "./potential-addon-table-column.component.html",
  styleUrls: ["./potential-addon-table-column.component.scss"],
})
export class PotentialAddonTableColumnComponent implements OnInit {
  @Input("addon") addon: GetAddonListItem;

  @Output() onViewDetails: EventEmitter<AddonSearchResult> = new EventEmitter();

  constructor() {}

  ngOnInit(): void {}

  viewDetails() {
    this.onViewDetails.emit(this.addon.searchResult);
  }
}
