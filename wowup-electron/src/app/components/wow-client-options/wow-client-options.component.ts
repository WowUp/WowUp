import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import * as AdmZip from "adm-zip";
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { AddonChannelType } from 'app/models/wowup/addon-channel-type';
import { ElectronService } from 'app/services';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { WowUpService } from 'app/services/wowup/wowup.service';
import { getEnumList, getEnumName } from 'app/utils/enum.utils';
import * as fs from 'fs';
import * as _ from 'lodash';
import { isEmpty } from 'lodash';
import * as path from 'path';
import { Subscription } from 'rxjs';
import { AlertDialogComponent } from '../alert-dialog/alert-dialog.component';
import { RestoreDialogComponent } from '../restore-dialog/restore-dialog.component';
@Component({
  selector: 'app-wow-client-options',
  templateUrl: './wow-client-options.component.html',
  styleUrls: ['./wow-client-options.component.scss']
})
export class WowClientOptionsComponent implements OnInit, OnDestroy {

  @Input('clientType') clientType: WowClientType;
  @ViewChild('myButton') button;
  private subscriptions: Subscription[] = [];

  public clientTypeName: string;
  public clientFolderName: string;
  public clientLocation: string;
  public selectedAddonChannelType: AddonChannelType;
  public addonChannelInfos: { type: AddonChannelType, name: string }[] = getEnumList(AddonChannelType)
    .map((type: AddonChannelType) => ({ type: type, name: getEnumName(AddonChannelType, type) }));
  public clientAutoUpdate: boolean;
  public disabledBackup: boolean;
  public disabledRestore: boolean;

  private _fullPath: string;
  private _pathBackup: string;

  constructor(
    private _dialog: MatDialog,
    private _electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService,
    private _cdRef: ChangeDetectorRef,
    private _snackBar: MatSnackBar,
    private _cd: ChangeDetectorRef,
    private _translate: TranslateService,
  ) {
    const warcraftProductSubscription = this._warcraftService.products$.subscribe(products => {
      const product = products.find(p => p.clientType === this.clientType);
      if (product) {
        this.clientLocation = product.location;
        this._cdRef.detectChanges();
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
    this.disabledBackup = true;
    this.disabledRestore = true;

    isEmpty(this.clientLocation);

    if (!isEmpty(this.clientLocation)) {
      this._fullPath = `${this.clientLocation}/${this.clientFolderName}`;
      this._pathBackup = `${this._fullPath}/WowUp_backup`;
      this.disabledBackup = false;
      this.disabledRestore = !fs.existsSync(this._pathBackup)
    }
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
      this.disabledBackup = isEmpty(this.clientLocation);
    }
  }

  async onCreateBackup() {
    if (!fs.existsSync(this._pathBackup)) {
      fs.mkdirSync(this._pathBackup)
    };

    this.disabledRestore = true;
    this._snackBar.open(this._translate.instant("PAGES.OPTIONS.WOW.BACKUP_STARTED"));


    setTimeout(() => {
      const zip = new AdmZip();
      zip.addLocalFolder(`${this._fullPath}/WTF`, 'WTF');
      zip.addLocalFolder(`${this._fullPath}/Interface`, 'Interface');
      zip.writeZip(`${this._pathBackup}/${Date.now()}.zip`);
      this.disabledRestore = false;
      this._snackBar.dismiss();
      this._cd.detectChanges()
    }, 1000);


  }

  onGetBackups() {
    if (!fs.existsSync(this._pathBackup)) {
      return
    };


    this._dialog.open(RestoreDialogComponent, {
      width: '450px',
      maxHeight:450,
      data: { pathBackup: this._pathBackup, fullPath: this._fullPath }
    });
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
