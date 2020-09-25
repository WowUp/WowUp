import { ErrorHandler, Inject, Injectable } from "@angular/core";
import * as Rollbar from 'rollbar';
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { Preferences } from "../../../constants";

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService implements ErrorHandler {
    private rollbarConfig = {
        accessToken: 'd01c11314a064572b11acee18d880650',
        captureUncaught: true,
        captureUnhandledRejections: true,
    };

    private _rollbar: Rollbar;
    private get rollbar() {
        if (!this.telemetryEnabled) {
            return undefined;
        }

        if (!this._rollbar) {
            this._rollbar = new Rollbar(this.rollbarConfig);
        }
        return this._rollbar;
    }

    private get telemetryEnabled() {
        return this._preferenceStorageService.get(Preferences.telemetryEnabledKey) === true.toString();
    }


    public get shouldPromptTelemetry() {
        return this._preferenceStorageService.get(Preferences.telemetryEnabledKey) === undefined;
    }

    constructor(
        private _preferenceStorageService: PreferenceStorageService
    ) { }

    // ErrorHandler
    handleError(error: any): void {
        console.error('Caught error', error);

        this.rollbar?.error(error.originalError || error);
    }
}