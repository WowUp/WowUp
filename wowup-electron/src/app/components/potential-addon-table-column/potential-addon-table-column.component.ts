import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { PotentialAddon } from "app/models/wowup/potential-addon";

@Component({
  selector: "app-potential-addon-table-column",
  templateUrl: "./potential-addon-table-column.component.html",
  styleUrls: ["./potential-addon-table-column.component.scss"],
})
export class PotentialAddonTableColumnComponent implements OnInit {
  @Input("addon") addon: PotentialAddon;

  @Output() onViewDetails: EventEmitter<PotentialAddon> = new EventEmitter();

  constructor() {}

  ngOnInit(): void { }

  viewDetails() {
    this.onViewDetails.emit(this.addon);
  }
}
