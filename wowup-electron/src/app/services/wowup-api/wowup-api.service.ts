import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap } from "rxjs/operators";
import { ScanRequest } from "app/models/wowup-api/scan.request";
import { AppConfig } from "environments/environment";
import { LatestVersionResponse } from "app/models/wowup-api/latest-version-response";
import { Observable } from "rxjs";

const API_URL = AppConfig.wowUpApiUrl;

@Injectable({
  providedIn: 'root'
})
export class WowUpApiService {

  constructor(
    private _httpClient: HttpClient
  ) { }

  public getLatestVersion(): Observable<LatestVersionResponse> {
    const url = new URL(`${API_URL}/wowup/latest`);

    return this._httpClient.get<LatestVersionResponse>(url.toString())
      .pipe(
        tap(res => console.log(res))
      );
  }
}