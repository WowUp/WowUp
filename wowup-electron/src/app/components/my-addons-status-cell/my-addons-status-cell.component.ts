import { Component, Input, OnInit } from '@angular/core';
import { Addon } from 'app/entities/addon';

@Component({
  selector: 'app-my-addons-status-cell',
  templateUrl: './my-addons-status-cell.component.html',
  styleUrls: ['./my-addons-status-cell.component.scss']
})
export class MyAddonsStatusCellComponent implements OnInit {

  @Input('addon') addon: Addon;

  showInstallButton = true;
  showProgress = false;
  progressText = 'Installing...'

  constructor() { }

  ngOnInit(): void {
  }

  onInstall() {
    this.showInstallButton = false;
    this.showProgress = true;
  }
}
