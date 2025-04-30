import { injectable } from 'inversify'
import { IService } from './service'
import { BrowserWindow } from 'electron'

export interface IRendererMessageService extends IService {
  setWindow(window: BrowserWindow): void
  sendMessage(messageName: string, messageBody: unknown): Promise<void>
}

@injectable()
export class RendererMessageService implements IRendererMessageService {
  private _window: BrowserWindow | undefined = undefined

  public init(): void {
    console.log('init NetworkService')
  }

  public setWindow(window: BrowserWindow): void {
    console.log('setWindow', window)
    this._window = window
  }

  public async sendMessage(messageName: string, messageBody: unknown): Promise<void> {
    if (this._window === undefined) {
      return
    }

    this._window.webContents.send(messageName, messageBody)
  }
}
