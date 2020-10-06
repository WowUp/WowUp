import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { AddonModel } from "app/business-objects/my-addons-list-item";

@Component({
  selector: "app-my-addons-addon-cell",
  templateUrl: "./my-addons-addon-cell.component.html",
  styleUrls: ["./my-addons-addon-cell.component.scss"],
})
export class MyAddonsAddonCellComponent implements OnInit {
  @Input("addon") listItem: AddonModel;

  @Output() onViewDetails: EventEmitter<AddonModel> = new EventEmitter();

  constructor() {}

  ngOnInit(): void {}

  viewDetails() {
    this.onViewDetails.emit(this.listItem);
  }
}
