import { ErrorHandler } from "@angular/core";

export class ErrorHandlerInterceptor implements ErrorHandler {
  public constructor() {}

  // ErrorHandler
  public handleError(error: Error): void {
    console.error("Caught error", error);
  }
}
