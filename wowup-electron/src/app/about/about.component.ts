import { Component, OnInit } from '@angular/core';
import { remote } from 'electron'
import { WowUpService } from 'app/core/services/wowup/wowup.service';
import { ChangeLog } from 'app/models/wowup/change-log';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  public version: string = '';
  public changeLogs: ChangeLog[] = [];

  constructor(private wowup: WowUpService) { }

  ngOnInit(): void {
    this.version = remote.app.getVersion();

    this.wowup.getChangeLogFile()
      .subscribe({
        next: (changelogFile) => {
          console.log('Change Logs', changelogFile)
          this.changeLogs = changelogFile.ChangeLogs;
        },
        error: (e) => {
          console.error(e);
        }
      });
  }

}
