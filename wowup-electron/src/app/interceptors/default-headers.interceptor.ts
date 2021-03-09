import { Observable } from "rxjs";

import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class DefaultHeadersInterceptor implements HttpInterceptor {
  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get the auth token from the service.

    console.log(`[${req.method}] ${req.urlWithParams}`);
    // Clone the request and replace the original headers with
    // cloned headers, updated with the authorization.
    // const authReq = req.clone({
    //   setHeaders: {
    //     // 'user-agent': USER_AGENT
    //   },
    // });

    // send cloned request with header to the next handler.
    return next.handle(req);
  }
}
