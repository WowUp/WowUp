import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';
import { Addon } from 'app/entities/addon';

@Component({
  selector: 'app-addon-context-menu',
  templateUrl: './addon-context-menu.component.html',
  styleUrls: ['./addon-context-menu.component.scss']
})
export class AddonContextMenuComponent implements OnInit, AfterViewInit {
  @Input('addon') addon: MyAddonsListItem;
  @Input('xPos') xPos: number;
  @Input('yPos') yPos: number;

  @ViewChild(MatMenuTrigger) contextMenu: MatMenuTrigger;

  constructor() { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    console.log(this.contextMenu);
    this.contextMenu.openMenu();
  }

}
