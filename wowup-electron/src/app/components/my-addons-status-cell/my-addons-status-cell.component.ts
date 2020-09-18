import { Component, Input, OnInit } from '@angular/core';
import { Addon } from 'app/entities/addon';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';
import { AddonDisplayState } from 'app/models/wowup/addon-display-state';

@Component({
  selector: 'app-my-addons-status-cell',
  templateUrl: './my-addons-status-cell.component.html',
  styleUrls: ['./my-addons-status-cell.component.scss']
})
export class MyAddonsStatusCellComponent implements OnInit {

  @Input('addon') listItem: MyAddonsListItem;

  progressText = 'Installing...'
  showProgressBar = false;
  showStatusText = false;
  showUpdateButton = false;

  get externalUrl() {
    return this.listItem.externalUrl;
  }

  get showInstallButton() {
    return this.listItem.displayState === AddonDisplayState.Install;
  }

  get statusText() {
    switch (this.listItem.displayState) {
      case AddonDisplayState.UpToDate:
        return "Up to Date";
      case AddonDisplayState.Ignored:
        return "Ignored";
      case AddonDisplayState.Update:
      case AddonDisplayState.Install:
      case AddonDisplayState.Unknown:
      default:
        return '';
    }
  }

  constructor() { }

  ngOnInit(): void {

    this.showStatusText = this.listItem.displayState == AddonDisplayState.UpToDate ||
      this.listItem.displayState == AddonDisplayState.Ignored;

    this.showUpdateButton = this.listItem.displayState === AddonDisplayState.Update;
  }

  onUpdate() {
    this.showStatusText = false;
    this.showUpdateButton = false;

    try {
      //TODO install
    } catch (err) {
      console.error('Failed to update addon', err);
      this.showUpdateButton = true;
    }
  }

}
