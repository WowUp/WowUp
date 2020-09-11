import { Component, OnInit, NgZone } from '@angular/core';
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { FileUtils } from 'app/utils/file.utils';
import { shell } from 'electron'
import * as path from 'path';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss']
})
export class OptionsComponent implements OnInit {

  public retailLocation = '';
  public classicLocation = '';
  public retailPtrLocation = '';
  public classicPtrLocation = '';
  public betaLocation = '';

  constructor(
    private warcraft: WarcraftService,
    private zone: NgZone
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  onShowLogs = () => {
    shell.openExternal(path.join(FileUtils.getUserDataPath(), 'logs'), { activate: true });
  }

  onReScan = () => {
    this.warcraft.scanProducts();
    this.loadData();
  }

  private loadData() {
    this.zone.run(() => {
      this.retailLocation = this.warcraft.getClientLocation(WowClientType.Retail);
      this.classicLocation = this.warcraft.getClientLocation(WowClientType.Classic);
      this.retailPtrLocation = this.warcraft.getClientLocation(WowClientType.RetailPtr);
      this.classicPtrLocation = this.warcraft.getClientLocation(WowClientType.ClassicPtr);
      this.betaLocation = this.warcraft.getClientLocation(WowClientType.Beta);
    })
  }

}
