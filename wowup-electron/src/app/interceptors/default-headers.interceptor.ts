import { Observable } from "rxjs";

import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { tap } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class DefaultHeadersInterceptor implements HttpInterceptor {
  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get the auth token from the service.

    // Clone the request and replace the original headers with
    // cloned headers, updated with the authorization.
    // const cloneReq = req.clone({
    //   headers: req.headers.set("startTimestamp", Date.now().toString()),
    // });
    const start = Date.now();
    const method = req.method;
    const url = req.urlWithParams;

    // send cloned request with header to the next handler.
    return next.handle(req).pipe(
      tap((response: any) => {
        try {
          if (response instanceof HttpResponse) {
            const t = Date.now() - start;
            console.log(`[${method}] ${url} ${response.status} ${t}ms`);
          }
        } catch (e) {
          console.error(e);
        }
      })
    );
  }
}
