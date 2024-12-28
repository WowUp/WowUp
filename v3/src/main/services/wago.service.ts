import { injectable } from 'inversify'
import { IService } from './service'
import { powerMonitor, WebContents } from 'electron'
import { BrowserWindow } from 'electron/main'

export interface IWagoService extends IService {
  setWindow(window: BrowserWindow): void
  setWebContents(webContents: WebContents): void
  setToken(token: string): void
}

@injectable()
export class WagoService implements IWagoService {
  private _window: BrowserWindow | undefined = undefined
  private _tokenMap = new Map<number, boolean>()
  private _webContents: WebContents | undefined = undefined
  private _tokenTimer: ReturnType<typeof setTimeout> | undefined = undefined

  public init(): void {
    console.log('init WagoService')
  }

  public constructor() {
    powerMonitor.on('resume', () => {
      console.log('[wago-handler] powerMonitor resume')
      this._tokenMap.clear()
      this._webContents?.reload()
    })
  }

  public setWindow(window: BrowserWindow): void {
    this._window = window

    window.webContents.on('did-attach-webview', (_e, webContents) => {
      webContents.on('did-start-navigation', (_evt, url) => {
        if (url === 'https://addons.wago.io/wowup_ad') {
          console.debug('[webview] did-start-navigation', url)
          this.setWebContents(webContents)
        }
      })
    })
  }

  public setToken(token: string): void {
    if (typeof token !== 'string' || token.length < 20) {
      console.warn(`[wago-handler] malformed token detected: ${token.length}`)
      return
    }

    console.warn('[wago-handler] clearing reload timer')
    this._tokenMap.set(this._webContents?.id ?? 0, true)
    this.stopTimeout()
    this._window?.webContents?.send('wago-token-received', token)
  }

  public setWebContents(webContents: WebContents): void {
    if (this._webContents !== undefined) {
      this.removeListeners(this._webContents)
    }

    this._webContents = webContents

    webContents.on('did-fail-provisional-load', this.onDidFailProvisionalLoad)
    webContents.on('did-fail-load', this.onDidFail)
    webContents.on('will-navigate', this.onWillNavigate)
    webContents.on('did-finish-load', () => {
      // console.debug("[wago-handler] did-finish-load");
      if (this._tokenMap.has(webContents.id)) {
        this.stopTimeout()
      }
    })

    // webview allowpopups must be enabled for any link to work
    // https://www.electronjs.org/docs/latest/api/webview-tag#allowpopups
    webContents.setWindowOpenHandler(this.onWindowOpenHandler)
  }

  private stopTimeout(): void {
    clearTimeout(this._tokenTimer)
    this._tokenTimer = undefined
  }

  private readonly onDidFailProvisionalLoad = (
    _evt: Electron.Event,
    code: number,
    description: string
  ): void => {
    console.error('[webview] did-fail-provisional-load', code, description)
    if (this._webContents !== undefined) {
      this.setReloadTime(this._webContents)
    }
  }

  private readonly onDidFail = (
    _evt: Electron.Event,
    code: number,
    description: string,
    url: string
  ): void => {
    console.error('[wago-handler] did-fail-load', code, description, url)
    if (this._webContents !== undefined) {
      this.setReloadTime(this._webContents)
    }
  }

  private readonly onWillNavigate = (evt: Electron.Event, url: string): void => {
    console.debug('[wago-handler] will-navigate', url)
    if (this._webContents !== undefined && this._webContents.getURL() === url) {
      console.debug(`[wago-handler] reload detected`)
    } else {
      evt.preventDefault() // block the webview from navigating at all
    }
  }

  private readonly onWindowOpenHandler = (details: Electron.HandlerDetails): { action: 'deny' } => {
    console.debug('[webview] setWindowOpenHandler')
    this._window?.webContents.send('webview-new-window', details) // forward this new window to the app for processing
    return { action: 'deny' }
  }

  private removeListeners(webContents: WebContents): void {
    this.stopTimeout()
    webContents.off('did-fail-provisional-load', this.onDidFailProvisionalLoad)
    webContents.off('did-fail-load', this.onDidFail)
    webContents.off('will-navigate', this.onWillNavigate)
    webContents.setWindowOpenHandler(() => ({ action: 'allow' }))
  }

  private setReloadTime(webContents: WebContents): void {
    if (this._tokenMap.has(webContents.id)) {
      return
    }

    if (this._tokenTimer === undefined) {
      console.warn('[wago-handler] setting reload timer')
      this._tokenTimer = setTimeout(() => {
        console.error('[wago-handler] reload')
        webContents.reload()
      }, 5000)
    }
  }
}
