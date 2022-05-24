import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

declare type UiMessageAction = "ad-frame-reload";

export interface UiMessage<T> {
  action: UiMessageAction;
  data?: T;
}

@Injectable({
  providedIn: "root",
})
export class UiMessageService {
  private readonly _messageSenderSrc = new Subject<UiMessage<any>>();

  public readonly message$ = this._messageSenderSrc.asObservable();

  public sendMessage(action: UiMessageAction, data?: any) {
    this._messageSenderSrc.next({
      action,
      data,
    });
  }
}
