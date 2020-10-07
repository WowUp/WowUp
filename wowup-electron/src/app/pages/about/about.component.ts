import { Component, Input, OnInit } from '@angular/core';
import { remote } from 'electron'
import { ChangeLog } from '../../models/wowup/change-log';

import * as ChangeLogJson from '../../../assets/changelog.json';
import { WowUpService } from 'app/services/wowup/wowup.service';
import { ElectronService } from 'app/services';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  
  @Input('tabIndex') tabIndex: number;

  public version = '';
  public changeLogs: ChangeLog[] = ChangeLogJson.ChangeLogs;

  constructor(
    private wowup: WowUpService,
    public electronService: ElectronService
  ) {}

  ngOnInit(): void {
    this.version = remote.app.getVersion();
  }

}
