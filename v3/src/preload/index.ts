import { contextBridge } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'
import { ipcRenderer } from 'electron/renderer'
import { WagoMessage } from '../shared/messages'

console.log(`[preload] : ${process.argv}`)

const BUILD_FLAVOR = import.meta.env.PRELOAD_VITE_BUILD_FLAVOR
const IS_WEBVIEW = process.argv.includes('--is-webview=1')

console.log(`[preload] : ${IS_WEBVIEW}`)

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ipcRenderer })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ipcRenderer
  }
  // @ts-ignore (define in dts)
  window.api = api
}

if (IS_WEBVIEW && BUILD_FLAVOR === 'wago') {
  const BACKOFF_KEY = 'wago-backoff'
  const BACKOFF_SET_KEY = 'wago-backoff-set'
  const BACKOFF_RESET_AGE = 5 * 60000
  const BACKOFF_MAX_WAIT = 2 * 60000

  let keyExpectedTimeout: number | undefined = undefined

  console.log('[wago-preload] loaded')

  window.addEventListener(
    'error',
    function (e) {
      const errMsg = e.error?.toString() || 'unknown error on ' + window.location
      console.error(`[wago-preload] error listener:`, e.message, errMsg)
      ipcRenderer.send('webview-error', e.error, e.message)

      if (keyExpectedTimeout != undefined) {
        backoffReload()
      }
    },
    true
  )

  contextBridge.exposeInMainWorld('wago', {
    provideApiKey: (key) => {
      window.clearTimeout(keyExpectedTimeout)
      keyExpectedTimeout = undefined
      console.debug(`[wago-preload] got key`)
      ipcRenderer.send(WagoMessage.TokenReceived, key)
    }
  })

  window.onerror = function (msg, url, lineNo, columnNo, error): boolean {
    console.error(`[wago-preload] error:`, msg, url, lineNo, columnNo, error)
    return false
  }

  // If the api key does not get populated after a certain time, reload
  // Can happen if the page returns bad responses (500 etc)
  keyExpectedTimeout = window.setTimeout(() => {
    console.log('[wago-preload] failed to get key in time, reloading')
    backoffReload()
  }, 30000)

  console.log(`[wago-preload] init`, window.location.href)

  const backoffReload = (): void => {
    const backoffSetStr = window.sessionStorage.getItem('wago-backoff-set')
    const backoffSet = backoffSetStr ? parseInt(backoffSetStr, 10) : 0

    const backoffStr = window.sessionStorage.getItem(BACKOFF_KEY)
    let backoff = Math.min(backoffStr ? parseInt(backoffStr, 10) * 2 : 2000, BACKOFF_MAX_WAIT)

    // If the backoff time is old, reset the backoff
    if (Date.now() - backoffSet > BACKOFF_RESET_AGE) {
      backoff = 2000
    }

    console.log('[wago] setting reload backoff', backoff)
    window.sessionStorage.setItem(BACKOFF_KEY, backoff.toString())
    window.sessionStorage.setItem(BACKOFF_SET_KEY, Date.now().toString())

    // Wait the calculated time
    window.setTimeout(() => {
      window.location.reload()
    }, backoff)
  }
}
