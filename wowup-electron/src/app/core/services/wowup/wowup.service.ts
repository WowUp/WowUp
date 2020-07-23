import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ChangeLogFile } from "app/models/wowup/change-log-file";
import { map } from 'rxjs/operators';
import { CachingService } from "../caching/caching-service";

const CHANGE_LOG_URL = 'https://wowup-builds.s3.us-east-2.amazonaws.com/changelog/changelog.json';
const CHANGE_LOG_CACHE_KEY = 'change_log_file';
const CHANGE_LOG_CACHE_TTL = 10 * 60 * 1000;

@Injectable({
    providedIn: 'root'
})
export class WowUpService {

    constructor(
        private cache: CachingService,
        private http: HttpClient) {

    }

    getChangeLogFile() {
        return this.http.get<ChangeLogFile>(CHANGE_LOG_URL)
            .pipe(
                map(response => {
                    this.cache.set(CHANGE_LOG_CACHE_KEY, response, CHANGE_LOG_CACHE_TTL)
                    return response;
                })
            );
    }
}