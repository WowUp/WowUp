import { injectable } from 'inversify'
import { IService } from './service'
import { BrowserWindow, Session } from 'electron'

export interface INetworkService extends IService {
  setWindow(window: BrowserWindow): void
  fetch(
    input: string | GlobalRequest,
    init?: RequestInit & { bypassCustomProtocolHandlers?: boolean }
  ): Promise<GlobalResponse>

  getJson<TOutput>(url: string | URL): Promise<TOutput>
  post<TOutput>(input: string, body: unknown): Promise<TOutput>
}

@injectable()
export class NetworkService implements INetworkService {
  private _window: BrowserWindow | undefined = undefined

  public init(): void {
    console.log('init NetworkService')
  }

  public setWindow(window: BrowserWindow): void {
    console.log('setWindow', window)
    this._window = window
  }

  public async fetch(
    input: string | GlobalRequest,
    init?: RequestInit & { bypassCustomProtocolHandlers?: boolean }
  ): Promise<GlobalResponse> {
    const session = this.getSession()
    return await session.fetch(input, init)
  }

  public async getJson<TOutput>(url: string | URL): Promise<TOutput> {
    const response = await this.fetch(url.toString())
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  public async post<TOutput>(input: string, body: unknown): Promise<TOutput> {
    const req: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (typeof body === 'object') {
      req.body = JSON.stringify(body)
    } else if (typeof body === 'string') {
      req.body = body
    }

    const response = await this.fetch(input, req)
    if (!response.ok) {
      throw new Error(`Failed to post to ${input}: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  private getSession(): Session {
    if (this._window === undefined) {
      throw new Error('Window is not set')
    }
    return this._window?.webContents.session
  }
}
