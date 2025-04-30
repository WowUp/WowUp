import { app, shell, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log/main'
import { join } from 'path'
import os from 'os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as svc from './services'
import { IPCHandler } from './handlers/ipc/ipc-handler'
import { BrowserWindowConstructorOptions } from 'electron/main'
import {
  APP_USER_MODEL_ID,
  APP_USER_MODEL_ID_CF,
  BUILD_FLAVOR,
  IS_PORTABLE,
  TYPES
} from './constants'
import { createContainer } from './dependencies'

const PRELOAD_PATH = join(__dirname, '../preload/index.js')

log.initialize()

log.log('BuildFlavor', BUILD_FLAVOR)
log.log(`Electron: ${process.versions.electron}`)
log.log(`BinaryPath: ${app.getPath('exe')}`)
log.log(`LogPath: ${app.getPath('logs')}`)
log.log('ExecPath', process.execPath)
log.log('Args', process.argv)

const userAgent = getUserAgent()
log.log('UserAgent', userAgent)

const container = createContainer()

function createWindow(): void {
  // Create the browser window.
  const windowOpts: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 700,
    show: false,
    transparent: false,
    resizable: true,
    autoHideMenuBar: true,
    title: 'WowUp' + BUILD_FLAVOR === 'ow' ? ' CF' : '',
    // titleBarStyle: "hidden",
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      allowRunningInsecureContent: false,
      webSecurity: false,
      webviewTag: true,
      sandbox: false,
      preload: PRELOAD_PATH
    }
  }

  const mainWindow = new BrowserWindow(windowOpts)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setUserAgent(userAgent)
  mainWindow.webContents.setAudioMuted(true)

  mainWindow.webContents.on('will-attach-webview', (_e, webPreferences, params) => {
    console.debug('will-attach-webview', webPreferences, params)
    webPreferences.contextIsolation = true
    webPreferences.plugins = false
    webPreferences.webgl = false
    webPreferences.additionalArguments = [`--is-webview=1`]
    webPreferences.preload = PRELOAD_PATH
  })

  mainWindow.webContents.on('did-attach-webview', (_e, webContents) => {
    console.debug('did-attach-webview', webContents.userAgent)
    webContents.session.setUserAgent(webContents.userAgent)

    webContents.on('preload-error', (_evt, _path, e) => {
      console.error('[webview] preload-error', e.message)
    })

    webContents.on('did-fail-provisional-load', (evt) => {
      console.error('[webview] did-fail-provisional-load', evt)
    })

    webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
      console.warn('[webview] setPermissionRequestHandler', permission)
      return callback(false)
    })

    webContents.session.setPermissionCheckHandler((_contents, permission, origin) => {
      if (['background-sync'].includes(permission)) {
        return true
      }

      console.warn('[webview] setPermissionCheckHandler', permission, origin)
      return false
    })
  })

  if (BUILD_FLAVOR === 'wago') {
    const wagoService = container.get<svc.IWagoService>(svc.WagoService)
    wagoService.setWindow(mainWindow)
    // wagoService.setWebContents(mainWindow.webContents)
  }

  const rendererMessageService = container.get<svc.IRendererMessageService>(
    TYPES.IRendererMessageService
  )
  rendererMessageService.setWindow(mainWindow)

  const networkService = container.get<svc.INetworkService>(TYPES.INetworkService)
  networkService.setWindow(mainWindow)
}

// Some servers don't supply good CORS headers for us, so we ignore them.
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,OutOfBlinkCors')

// Set the app ID so that our notifications work correctly on Windows
app.setAppUserModelId(BUILD_FLAVOR === 'ow' ? APP_USER_MODEL_ID_CF : APP_USER_MODEL_ID)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  const handlers = container.getAll<IPCHandler>('Handler')
  for (const handler of handlers) {
    handler.init(ipcMain)
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

function getUserAgent(): string {
  const portableStr = IS_PORTABLE ? ' portable;' : ''
  return `WowUp-Client/${app.getVersion()} (${os.type()}; ${os.release()}; ${os.arch()}; ${BUILD_FLAVOR === 'ow' ? 'CF;' : ''} ${portableStr} +https://wowup.io)`
}
