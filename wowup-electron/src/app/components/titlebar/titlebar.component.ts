import { Component, OnInit } from '@angular/core';
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

  constructor() { }

  ngOnInit(): void {
  }

}
