import { Component, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, ICellRendererParams } from 'ag-grid-community';
import { Addon } from 'app/entities/addon';

@Component({
  selector: 'app-addon-status-column',
  templateUrl: './addon-status-column.component.html',
  styleUrls: ['./addon-status-column.component.scss']
})
export class AddonStatusColumnComponent implements ICellRendererAngularComp {
  public addon: Addon;

  constructor() { }
  
  refresh(params: any): boolean {
    throw new Error("Method not implemented.");
  }

  agInit(params: ICellRendererParams): void {
    this.addon = params.data;
    // console.log(this.addon)
  }

  afterGuiAttached?(params?: IAfterGuiAttachedParams): void {
    throw new Error("Method not implemented.");
  }

}
