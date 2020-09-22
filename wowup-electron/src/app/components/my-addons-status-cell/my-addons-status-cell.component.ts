import { Component, Input, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { Addon } from 'app/entities/addon';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';
import { AddonDisplayState } from 'app/models/wowup/addon-display-state';
import { AddonService } from 'app/services/addons/addon.service';
import { AddonInstallState } from 'app/models/wowup/addon-install-state';
import { MatColumnDef, MatTable } from '@angular/material/table';

@Component({
  selector: 'app-my-addons-status-cell',
  templateUrl: './my-addons-status-cell.component.html',
  styleUrls: ['./my-addons-status-cell.component.scss']
})
export class MyAddonsStatusCellComponent implements OnInit, OnDestroy {
  @Input()
  get name(): string { return this._name; }
  set name(name: string) {
    this._name = name;
    if(this.columnDef){
      this.columnDef.name = name;
    }
  }
  _name: string;


  @Input('addon') listItem: MyAddonsListItem;

  @ViewChild(MatColumnDef) columnDef: MatColumnDef;

  progressText = 'Installing...';
  progressPercent = 0;
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

  constructor(
    @Optional() public table: MatTable<any>,
    private _addonService: AddonService
  ) { }

  ngOnInit(): void {

    // this.showStatusText = this.listItem.displayState == AddonDisplayState.UpToDate ||
    //   this.listItem.displayState == AddonDisplayState.Ignored;

    // this.showUpdateButton = this.listItem.displayState === AddonDisplayState.Update;
  }

  ngOnDestroy(): void {
    console.debug('DESTROY');
    if (this.table) {
      this.table.removeColumnDef(this.columnDef);
    }
  }

  onUpdate() {
    this.showStatusText = false;
    this.showUpdateButton = false;

    try {
      this._addonService.installAddon(this.listItem.id, this.onUpdateProgress);
    } catch (err) {
      console.error('Failed to update addon', err);
      this.showUpdateButton = true;
    }
  }

  private onUpdateProgress = (installState: AddonInstallState, progress: number) => {
    try {
      this.progressText = this.getInstallStateText(installState);
      this.progressPercent = progress;
      this.showProgressBar = true;
    } catch (err) {
      console.error(err);
    }
  }

  private getInstallStateText(installState: AddonInstallState) {
    switch (installState) {
      case AddonInstallState.Pending:
        return "Pending";
      case AddonInstallState.Downloading:
        return "Downloading";
      case AddonInstallState.BackingUp:
        return "BackingUp";
      case AddonInstallState.Installing:
        return "Installing";
      case AddonInstallState.Complete:
        return "Complete";
      default:
        return "Unknown";
    }
  }

}
