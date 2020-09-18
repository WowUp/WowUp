import { Component, Input, OnInit } from '@angular/core';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';
import { Addon } from 'app/entities/addon';

@Component({
  selector: 'app-addon-context-menu',
  templateUrl: './addon-context-menu.component.html',
  styleUrls: ['./addon-context-menu.component.scss']
})
export class AddonContextMenuComponent implements OnInit {
  @Input('addon') addon: MyAddonsListItem;

  constructor() { }

  ngOnInit(): void {
  }

}
