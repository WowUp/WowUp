import { HttpInterceptor, HttpRequest, HttpHandler } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AppConfig } from '../../../environments/environment';
import { release, arch } from 'os';

const USER_AGENT = `WowUp-Client/${AppConfig.appVersion} (${release()}; ${arch()}; +https://wowup.io)`;
console.log('USER_AGENT', USER_AGENT);

@Injectable()
export class DefaultHeadersInterceptor implements HttpInterceptor {

    intercept(req: HttpRequest<any>, next: HttpHandler) {
        // Get the auth token from the service.

        // Clone the request and replace the original headers with
        // cloned headers, updated with the authorization.
        const authReq = req.clone({
            setHeaders: {
                // 'user-agent': USER_AGENT
            }
        });

        // send cloned request with header to the next handler.
        return next.handle(authReq);
    }
}
