import { Component, OnInit } from '@angular/core';
import { WowUpService } from 'app/services/wowup/wowup.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

  constructor(
    public wowUpService: WowUpService
  ) { }

  ngOnInit(): void {
  }

}
