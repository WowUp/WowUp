import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { AppConfig } from './environments/environment';
import * as log from 'electron-log';
import { remote } from 'electron';
import { join } from 'path';

log.transports.file.resolvePath = (variables: log.PathVariables) => {
  return join(remote.app.getPath('logs'), variables.fileName);
}

if (AppConfig.production) {
  enableProdMode();
}

console.log = function (message?: any, ...optionalParams: any[]) {
  log.info(message, ...optionalParams);
}
console.warn = function (message?: any, ...optionalParams: any[]) {
  log.warn(message, ...optionalParams);
}
console.error = function (message?: any, ...optionalParams: any[]) {
  log.error(message, ...optionalParams);
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    preserveWhitespaces: false
  })
  .catch(err => console.error(err));

// new WowUpTitlebar();

// new Titlebar({
//   backgroundColor: Color.fromHex('#6B69D6'),
//   menu: null,
//   icon: '/assets/wowup_logo_512np.png'
// });

document.addEventListener('click', (evt: any) => {
  if (evt.target.tagName === 'A' && evt.target.href.startsWith('http')) {
    evt.preventDefault()
  }
});

// Disable file drop
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

const BrowserWindow = remote.BrowserWindow;

for (let window of BrowserWindow.getAllWindows()) {
  window.webContents
    .setVisualZoomLevelLimits(1, 3)
    .then(() => console.log('Zoom levels have been set between 100% and 300%'))
    .catch((err) => console.log(err));

  window.webContents.on('zoom-changed', (event, zoomDirection) => {
    let currentZoom = window.webContents.getZoomFactor();
    if (zoomDirection === 'in') {
      // setting the zoomFactor comes at a cost, this early return greatly improves performance
      if (Math.round(currentZoom * 100) == 300) {
        return;
      }

      if (currentZoom > 3.0) {
        window.webContents.zoomFactor = 3.0;

        return;
      }

      window.webContents.zoomFactor = currentZoom + 0.2;

      return;
    }
    if (zoomDirection === 'out') {
      // setting the zoomFactor comes at a cost, this early return greatly improves performance
      if (Math.round(currentZoom * 100) == 100) {
        return;
      }

      if (currentZoom < 1.0) {
        window.webContents.zoomFactor = 1.0;

        return;
      }

      window.webContents.zoomFactor = currentZoom - 0.2;
    }
  });
}
