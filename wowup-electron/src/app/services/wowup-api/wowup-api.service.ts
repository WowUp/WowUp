import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppConfig } from "../../../environments/environment";
import { LatestVersionResponse } from "../../models/wowup-api/latest-version-response";

const API_URL = AppConfig.wowUpApiUrl;

@Injectable({
  providedIn: "root",
})
export class WowUpApiService {
  constructor(private _httpClient: HttpClient) {}

  public getLatestVersion(): Observable<LatestVersionResponse> {
    const url = new URL(`${API_URL}/wowup/latest`);

    return this._httpClient.get<LatestVersionResponse>(url.toString()).pipe(tap((res) => console.log(res)));
  }
}
