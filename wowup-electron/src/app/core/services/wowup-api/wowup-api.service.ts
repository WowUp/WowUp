import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap } from "rxjs/operators";
import { ScanRequest } from "app/models/wowup-api/scan.request";

const API_URL = 'http://localhost:3000/dev';

@Injectable({
    providedIn: 'root'
})
export class WowUpApiService {

    constructor(
        private _httpClient: HttpClient
    ) { }

    public scanAddon(requst: ScanRequest) {
        const url = new URL(`${API_URL}/addons/scan`);

        return this._httpClient.post(url.toString(), requst)
            .pipe(
                tap(res => console.log(res))
            )
            .toPromise();
    }
}