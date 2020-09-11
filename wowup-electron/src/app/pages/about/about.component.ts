import { Component, OnInit } from '@angular/core';
import { remote } from 'electron'
import { ChangeLog } from '../../models/wowup/change-log';

import * as ChangeLogJson from '../../../assets/changelog.json';
import { WowUpService } from 'app/services/wowup/wowup.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  public version = '';
  public changeLogs: ChangeLog[] = ChangeLogJson.ChangeLogs;

  constructor(private wowup: WowUpService) { 
    console.log('ChangeLogJson', ChangeLogJson)
  }

  ngOnInit(): void {
    this.version = remote.app.getVersion();
  }

}
