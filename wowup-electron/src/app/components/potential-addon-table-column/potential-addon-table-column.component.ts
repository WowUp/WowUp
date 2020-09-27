import { Component, Input, OnInit } from '@angular/core';
import { PotentialAddon } from 'app/models/wowup/potential-addon';

@Component({
  selector: 'app-potential-addon-table-column',
  templateUrl: './potential-addon-table-column.component.html',
  styleUrls: ['./potential-addon-table-column.component.scss']
})
export class PotentialAddonTableColumnComponent implements OnInit {

  @Input('addon') addon: PotentialAddon;

  constructor() { }

  ngOnInit(): void {
  }

}
