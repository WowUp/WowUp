import { Component, OnInit } from '@angular/core';
import { ElectronService } from 'app/services/electron/electron.service';
import { WowUpService } from 'app/services/wowup/wowup.service';
import { platform } from 'os'

@Component({
  selector: 'app-titlebar',
  templateUrl: './titlebar.component.html',
  styleUrls: ['./titlebar.component.scss']
})
export class TitlebarComponent implements OnInit {

  public isMac = platform() === 'darwin';
  public isWindows = platform() === 'win32';
  public isLinux = platform() === 'linux';
  public userAgent = platform();

  constructor(
    public electronService: ElectronService,
    private _wowUpService: WowUpService
  ) { }

  ngOnInit(): void {
  }

  onClickClose() {
    if(this._wowUpService.collapseToTray){
      this.electronService.hideWindow();
    } else {
      this.electronService.closeWindow();
    }
  }

  onClickDebug(){
    this.electronService.remote.getCurrentWebContents().openDevTools();
  }

}
