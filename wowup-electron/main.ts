import { app, BrowserWindow, screen, BrowserWindowConstructorOptions, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { release, arch } from 'os';

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

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
