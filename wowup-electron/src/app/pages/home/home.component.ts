import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from 'app/services/session/session.service';
import { WowUpService } from 'app/services/wowup/wowup.service';
import { GetAddonsComponent } from '../get-addons/get-addons.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  constructor(
    private router: Router,
    private wowup: WowUpService,
    private _sessionService: SessionService
  ) { }

  ngOnInit(): void {
    this._sessionService.appLoaded();
  }

  onSelectedIndexChange(index: number) {
    this._sessionService.selectedHomeTab = index;
  }
}
