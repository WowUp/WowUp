import { Component, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from "ag-grid-angular";
import { ICellRendererParams, IAfterGuiAttachedParams } from 'ag-grid-community';
import { Addon } from 'app/entities/addon';

@Component({
  selector: 'app-addon-table-column',
  templateUrl: './addon-table-column.component.html',
  styleUrls: ['./addon-table-column.component.scss']
})
export class AddonTableColumnComponent implements ICellRendererAngularComp {

  public addon: Addon;

  constructor() { }

  refresh(params: any): boolean {
    throw new Error("Method not implemented.");
  }

  agInit(params: ICellRendererParams): void {
    this.addon = params.data;
    console.log(this.addon)
  }

  afterGuiAttached?(params?: IAfterGuiAttachedParams): void {
    throw new Error("Method not implemented.");
  }

}
