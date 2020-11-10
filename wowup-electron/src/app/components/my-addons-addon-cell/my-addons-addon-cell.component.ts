import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { AddonDependencyType } from "app/models/wowup/addon-dependency-type";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";

@Component({
  selector: "app-my-addons-addon-cell",
  templateUrl: "./my-addons-addon-cell.component.html",
  styleUrls: ["./my-addons-addon-cell.component.scss"],
})
export class MyAddonsAddonCellComponent implements OnInit {
  @Input("addon") listItem: AddonViewModel;
  @Input() showUpdateToVersion = false;

  @Output() onViewDetails: EventEmitter<AddonViewModel> = new EventEmitter();

  constructor() {}

  ngOnInit(): void {}

  viewDetails() {
    this.onViewDetails.emit(this.listItem);
  }

  getRequireDependencyCount() {
    return this.listItem.getDependencies(AddonDependencyType.Required).length;
  }

  hasRequiredDependencies() {
    return this.getRequireDependencyCount() > 0;
  }

  get dependencyTooltip() {
    return {
      dependencyCount: this.getRequireDependencyCount(),
    };
  }
}
