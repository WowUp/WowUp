import { app, BrowserWindow, screen, BrowserWindowConstructorOptions, Tray, Menu, nativeImage, ipcMain } from 'electron';
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
import { DOWNLOAD_FILE_CHANNEL, UNZIP_FILE_CHANNEL, COPY_FILE_CHANNEL, COPY_DIRECTORY_CHANNEL, DELETE_DIRECTORY_CHANNEL, RENAME_DIRECTORY_CHANNEL, READ_FILE_CHANNEL, STAT_DIRECTORY_CHANNEL, LIST_FILES_CHANNEL } from './src/common/constants';
import { UnzipStatusType } from './src/common/models/unzip-status-type';
import { UnzipRequest } from './src/common/models/unzip-request';
import { CopyFileRequest } from './src/common/models/copy-file-request';
import { CopyDirectoryRequest } from './src/common/models/copy-directory-request';
import { DeleteDirectoryRequest } from './src/common/models/delete-directory-request';
import { ReadFileRequest } from './src/common/models/read-file-request';
import { ReadFileResponse } from './src/common/models/read-file-response';
import { ListFilesRequest } from './src/common/models/list-files-request';
import { ListFilesResponse } from './src/common/models/list-files-response';
import { ncp } from 'ncp';
import * as rimraf from 'rimraf';

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
electronDl();

const appVersion = require('./package.json').version;
const USER_AGENT = `WowUp-Client/${appVersion} (${release()}; ${arch()}; +https://wowup.io)`;

const isWin = process.platform === "win32";

let win: BrowserWindow = null;
let tray: Tray = null;

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createTray() {
  console.log('TRAY')
  const trayIconPath = path.join(__dirname, 'src', 'assets', 'wowup_logo_512np.png');
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16 });

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'WowUp', type: 'normal', icon: icon, enabled: false },
    { label: 'Close', type: 'normal', role: 'quit' },
  ])

  tray.on('click', function (event) {
    console.log('SHOW')
    win.show();
  });

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
  win.webContents.once('dom-ready', () => {
    win.webContents.openDevTools();
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

ipcMain.on(LIST_FILES_CHANNEL, async (evt, arg: ListFilesRequest) => {
  console.log('list files', arg);
  const response: ListFilesResponse = {
    files: []
  };

  try {
    response.files = await readDirRecursive(arg.sourcePath);

  } catch (err) {
    response.error = err;
  }

  win.webContents.send(arg.sourcePath, response);
});

async function readDirRecursive(sourcePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const dirFiles: string[] = [];
    fs.readdir(sourcePath, { withFileTypes: true }, async (err, files) => {
      if (err) {
        return reject(err);
      }

      for (let file of files) {
        const filePath = path.join(sourcePath, file.name);
        if (file.isDirectory()) {
          const nestedFiles = await readDirRecursive(filePath);
          dirFiles.push(...nestedFiles);
        } else {
          dirFiles.push(filePath)
        }
      }

      resolve(dirFiles);
    });
  });
}
