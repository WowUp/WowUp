import { Component, Input, OnInit } from '@angular/core';
import { Addon } from 'app/entities/addon';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';

@Component({
  selector: 'app-my-addons-addon-cell',
  templateUrl: './my-addons-addon-cell.component.html',
  styleUrls: ['./my-addons-addon-cell.component.scss']
})
export class MyAddonsAddonCellComponent implements OnInit {

  @Input('addon') addon: MyAddonsListItem;

  constructor() { }

  ngOnInit(): void {
  }

}
