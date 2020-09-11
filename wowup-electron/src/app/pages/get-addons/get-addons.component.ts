import { Component, OnInit } from '@angular/core';
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { AddonService } from 'app/services/addons/addon.service';

@Component({
  selector: 'app-get-addons',
  templateUrl: './get-addons.component.html',
  styleUrls: ['./get-addons.component.scss']
})
export class GetAddonsComponent implements OnInit {

  private gridApi;

  public displayedColumns: string[] = ['position', 'name', 'weight', 'symbol'];

  public dataSource = [
    { position: 1, name: 'Hydrogen', weight: 1.0079, symbol: 'H' },
    { position: 2, name: 'Helium', weight: 4.0026, symbol: 'He' },
    { position: 3, name: 'Lithium', weight: 6.941, symbol: 'Li' },
    { position: 4, name: 'Beryllium', weight: 9.0122, symbol: 'Be' },
    { position: 5, name: 'Boron', weight: 10.811, symbol: 'B' },
    { position: 6, name: 'Carbon', weight: 12.0107, symbol: 'C' },
    { position: 7, name: 'Nitrogen', weight: 14.0067, symbol: 'N' },
    { position: 8, name: 'Oxygen', weight: 15.9994, symbol: 'O' },
    { position: 9, name: 'Fluorine', weight: 18.9984, symbol: 'F' },
    { position: 10, name: 'Neon', weight: 20.1797, symbol: 'Ne' },
  ];

  public query = '';
  public selectedClient = WowClientType.Classic;

  constructor(
    private _addonService: AddonService
  ) { }

  ngOnInit(): void {
  }

  onGridReady(params) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
  }

  private loadPopularAddons(){
    if(this.selectedClient === WowClientType.None){
      return;
    }


  }
}
