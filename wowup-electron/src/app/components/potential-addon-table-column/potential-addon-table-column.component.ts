import { Component, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, ICellRendererParams } from 'ag-grid-community';
import { PotentialAddon } from 'app/models/wowup/potential-addon';

@Component({
  selector: 'app-potential-addon-table-column',
  templateUrl: './potential-addon-table-column.component.html',
  styleUrls: ['./potential-addon-table-column.component.scss']
})
export class PotentialAddonTableColumnComponent implements ICellRendererAngularComp {

  public addon: PotentialAddon;

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
