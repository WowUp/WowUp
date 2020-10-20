import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { ElectronService } from 'app/services';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { getEnumList, getEnumName } from 'app/utils/enum.utils';
import * as path from 'path';
import * as _ from 'lodash';
import { AlertDialogComponent } from '../alert-dialog/alert-dialog.component';
import { AddonChannelType } from 'app/models/wowup/addon-channel-type';
import { WowUpService } from 'app/services/wowup/wowup.service';
import { MatSelectChange } from '@angular/material/select';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-wow-client-options',
  templateUrl: './wow-client-options.component.html',
  styleUrls: ['./wow-client-options.component.scss']
})
export class WowClientOptionsComponent implements OnInit, OnDestroy {

  @Input('clientType') clientType: WowClientType;

  private subscriptions: Subscription[] = [];

  public clientTypeName: string;
  public clientFolderName: string;
  public clientLocation: string;
  public selectedAddonChannelType: AddonChannelType;
  public addonChannelInfos: { type: AddonChannelType, name: string }[] = getEnumList(AddonChannelType)
    .map((type: AddonChannelType) => ({ type: type, name: getEnumName(AddonChannelType, type) }));
  public clientAutoUpdate: boolean;

  constructor(
    private _dialog: MatDialog,
    private _electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService
  ) {
    const warcraftProductSubscription = this._warcraftService.products$.subscribe(products => {
      const product = products.find(p => p.clientType === this.clientType);
      if (product) {
        this.clientLocation = product.location;
      }
    });

    this.subscriptions.push(warcraftProductSubscription);
  }

  ngOnInit(): void {
    this.selectedAddonChannelType = this._wowupService.getDefaultAddonChannel(this.clientType);
    this.clientAutoUpdate = this._wowupService.getDefaultAutoUpdate(this.clientType);
    this.clientTypeName = getEnumName(WowClientType, this.clientType);
    this.clientFolderName = this._warcraftService.getClientFolderName(this.clientType);
    this.clientLocation = this._warcraftService.getClientLocation(this.clientType);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onDefaultAddonChannelChange(evt: MatSelectChange) {
    this._wowupService.setDefaultAddonChannel(this.clientType, evt.value);
  }

  onDefaultAutoUpdateChange(evt: MatSlideToggleChange) {
    this._wowupService.setDefaultAutoUpdate(this.clientType, evt.checked);
  }

  async onSelectClientPath() {
    const selectedPath = await this.selectWowClientPath(this.clientType);
    if (selectedPath) {
      this.clientLocation = selectedPath;
    }
  }

  private async selectWowClientPath(clientType: WowClientType): Promise<string> {
    const dialogResult = await this._electronService.remote.dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (dialogResult.canceled) {
      return '';
    }

    const selectedPath = _.first(dialogResult.filePaths);
    if (!selectedPath) {
      console.warn('No path selected')
      return '';
    }

    console.log('dialogResult', selectedPath);

    if (this._warcraftService.setWowFolderPath(clientType, selectedPath)) {
      return selectedPath;
    }

    const clientFolderName = this._warcraftService.getClientFolderName(clientType);
    const clientExecutableName = this._warcraftService.getExecutableName(clientType);
    const clientExecutablePath = path.join(selectedPath, clientFolderName, clientExecutableName);
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      data: {
        title: `Alert`,
        message: `Unable to set "${selectedPath}" as your ${getEnumName(WowClientType, clientType)} folder.\nPath not found: "${clientExecutablePath}".`
      }
    });

    await dialogRef.afterClosed().toPromise();

    return '';
  }

}
