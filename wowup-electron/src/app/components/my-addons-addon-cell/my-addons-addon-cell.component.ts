import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";

@Component({
  selector: "app-my-addons-addon-cell",
  templateUrl: "./my-addons-addon-cell.component.html",
  styleUrls: ["./my-addons-addon-cell.component.scss"],
})
export class MyAddonsAddonCellComponent implements OnInit {
  @Input("addon") listItem: AddonViewModel;

  @Output() onViewDetails: EventEmitter<AddonViewModel> = new EventEmitter();

  constructor() {}

  ngOnInit(): void {}

  viewDetails() {
    this.onViewDetails.emit(this.listItem);
  }
}
