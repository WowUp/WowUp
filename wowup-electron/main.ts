import { app, BrowserWindow, screen, BrowserWindowConstructorOptions, Tray, Menu, nativeImage, ipcMain, MenuItem, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { release, arch } from 'os';
import * as electronDl from 'electron-dl';
import * as admZip from 'adm-zip';
import { DownloadRequest } from './src/common/models/download-request';
import { DownloadStatus } from './src/common/models/download-status';
import { DownloadStatusType } from './src/common/models/download-status-type';
import { UnzipStatus } from './src/common/models/unzip-status';
import { DOWNLOAD_FILE_CHANNEL, UNZIP_FILE_CHANNEL, COPY_FILE_CHANNEL, COPY_DIRECTORY_CHANNEL, DELETE_DIRECTORY_CHANNEL, RENAME_DIRECTORY_CHANNEL, READ_FILE_CHANNEL } from './src/common/constants';
import { UnzipStatusType } from './src/common/models/unzip-status-type';
import { UnzipRequest } from './src/common/models/unzip-request';
import { CopyFileRequest } from './src/common/models/copy-file-request';
import { CopyDirectoryRequest } from './src/common/models/copy-directory-request';
import { DeleteDirectoryRequest } from './src/common/models/delete-directory-request';
import { ReadFileRequest } from './src/common/models/read-file-request';
import { ReadFileResponse } from './src/common/models/read-file-response';
import './ipc-events';
import { ncp } from 'ncp';
import * as rimraf from 'rimraf';
import * as log from 'electron-log';
import { autoUpdater } from "electron-updater"
import * as Store from 'electron-store'

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const preferenceStore = new Store({ name: 'preferences' });

let appIsQuitting = false;

autoUpdater.logger = log;
autoUpdater.on('update-available', () => {
  log.info('AVAILABLE')
  win.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  log.info('DOWNLOADED')
  win.webContents.send('update_downloaded');
});

const appMenuTemplate: Array<MenuItemConstructorOptions | MenuItem> = isMac ? [
  {
    label: app.name,
    submenu: [
      { role: 'quit' }
    ]
  },
  {
    label: "Edit",
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: "separator" },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }
] : [];

const appMenu = Menu.buildFromTemplate(appMenuTemplate);
Menu.setApplicationMenu(appMenu);

const LOG_PATH = path.join(app.getPath('userData'), 'logs');
app.setAppLogsPath(LOG_PATH);
log.transports.file.resolvePath = (variables: log.PathVariables, message?: log.LogMessage) => {
  console.log('RES', path.join(LOG_PATH, variables.fileName))
  return path.join(LOG_PATH, variables.fileName);
}
log.info('Main starting');

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
electronDl();

const USER_AGENT = `WowUp-Client/${app.getVersion()} (${release()}; ${arch()}; +https://wowup.io)`;
log.info('USER_AGENT', USER_AGENT);

let win: BrowserWindow = null;
let tray: Tray = null;

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createTray() {
  console.log('TRAY')
  const trayIconPath = path.join(__dirname, 'assets', 'wowup_logo_512np.png');
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16 });

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: app.name, type: 'normal', icon: icon, enabled: false },
    {
      label: 'Show', click: () => {
        win.show();

        if (isMac) {
          app.dock.show();
        }
      }
    },
    { role: 'quit' },
  ]);

  if (isWin) {
    tray.on('click', function (event) {
      console.log('SHOW')
      win.show();
    });
  }

  tray.setToolTip('WowUp')
  tray.setContextMenu(contextMenu)
}

function createWindow(): BrowserWindow {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  const windowOptions: BrowserWindowConstructorOptions = {
    width: 900,
    height: 600,
    backgroundColor: '#444444',
    // frame: false,
    title: 'WowUp',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
      webSecurity: false,
      enableRemoteModule: true
    },
    minWidth: 900,
    minHeight: 550
  };

  if (isWin) {
    windowOptions.frame = false;
  }

  // Create the browser window.
  win = new BrowserWindow(windowOptions);

  win.webContents.userAgent = USER_AGENT;
  // win.webContents.once('dom-ready', () => {
  //   win.webContents.openDevTools();
  // });

  win.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify()
      .then((result) => {
        console.log('UPDATE', result)
      })
  });

  if (isMac) {
    win.on('close', (e) => {
      if (appIsQuitting) {
        return;
      }

      e.preventDefault();
      win.hide();

      if (preferenceStore.get('collapse_to_tray') === true) {
        app.dock.hide();
      }
    });
  }

  win.once('closed', () => {
    win = null;
  })

  if (serve) {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    win.loadURL('http://localhost:4200');

  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  // win.on('closed', () => {
  //   // Dereference the window object, usually you would store window
  //   // in an array if your app supports multi windows, this is the time
  //   // when you should delete the corresponding element.
  //   win = null;
  // });


  // win.on('minimize', function (event) {
  //   event.preventDefault();
  //   win.hide();
  // });

  // win.on('restore', function (event) {
  //   win.show();
  // });

  return win;
}

try {
  app.allowRendererProcessReuse = true;

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(() => {
      createWindow();
      createTray();
    }, 400)
  });

  app.on('before-quit', (e) => {
    appIsQuitting = true;
  })

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (isMac) {
      app.dock.show();
      win.show();
    }

    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}

ipcMain.on(DOWNLOAD_FILE_CHANNEL, async (evt, arg: DownloadRequest) => {
  try {
    const download = await electronDl.download(
      win,
      arg.url,
      {
        directory: arg.outputFolder,
        onProgress: (progress) => {
          win.webContents.send(arg.url, {
            type: DownloadStatusType.Progress,
            progress: parseFloat((progress.percent * 100.0).toFixed(2))
          } as DownloadStatus);
        }
      }
    );

    win.webContents.send(arg.url, {
      type: DownloadStatusType.Complete,
      savePath: download.getSavePath()
    } as DownloadStatus);
  } catch (err) {
    console.error(err);
    win.webContents.send(arg.url, { type: DownloadStatusType.Error, error: err } as DownloadStatus)
  }
});

ipcMain.on(UNZIP_FILE_CHANNEL, async (evt, arg: UnzipRequest) => {
  const zipFilePath = arg.zipFilePath;
  const outputFolder = arg.outputFolder;

  const zip = new admZip(zipFilePath);
  zip.extractAllToAsync(outputFolder, true, (err) => {
    const status: UnzipStatus = {
      type: UnzipStatusType.Complete,
      outputFolder
    };

    if (err) {
      status.type = UnzipStatusType.Error;
      status.error = err;
    }

    win.webContents.send(zipFilePath, status)
  });
});

ipcMain.on(COPY_FILE_CHANNEL, async (evt, arg: CopyFileRequest) => {
  console.log('Copy File', arg);
  fs.copyFile(arg.sourceFilePath, arg.destinationFilePath, (err) => {
    win.webContents.send(arg.destinationFilePath, { error: err });
  });
});

ipcMain.on(COPY_DIRECTORY_CHANNEL, async (evt, arg: CopyDirectoryRequest) => {
  console.log('Copy Dir', arg);
  ncp(arg.sourcePath, arg.destinationPath, (err) => {
    win.webContents.send(arg.destinationPath, err);
  });
});

ipcMain.on(DELETE_DIRECTORY_CHANNEL, async (evt, arg: DeleteDirectoryRequest) => {
  console.log('Delete Dir', arg);
  rimraf(arg.sourcePath, (err) => {
    win.webContents.send(arg.sourcePath, err);
  });
});

ipcMain.on(RENAME_DIRECTORY_CHANNEL, async (evt, arg: CopyDirectoryRequest) => {
  console.log('Rename Dir', arg);
  fs.rename(arg.sourcePath, arg.destinationPath, (err) => {
    win.webContents.send(arg.destinationPath, err);
  })
});

ipcMain.on(READ_FILE_CHANNEL, async (evt, arg: ReadFileRequest) => {
  // console.log('Read File', arg);
  fs.readFile(arg.sourcePath, { encoding: 'utf-8' }, (err, data) => {
    const response: ReadFileResponse = {
      data: data,
      error: err
    }
    win.webContents.send(arg.sourcePath, response);
  });
});


