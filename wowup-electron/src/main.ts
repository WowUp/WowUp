import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { AppConfig } from './environments/environment';
import * as log from 'electron-log';
import { app, remote } from 'electron';
import { join } from 'path';

log.transports.file.resolvePath = (variables: log.PathVariables, message?: log.LogMessage) => {
  return join(remote.app.getPath('logs'), variables.fileName);
}

if (AppConfig.production) {
  enableProdMode();
}

const oldTrace = console.trace;
const oldDebug = console.debug;
const oldLog = console.log;
const oldWarn = console.warn;
const oldError = console.error;

console.log = function(message?: any, ...optionalParams: any[]) {
  // oldLog.call(console, message, ...optionalParams);
  log.info(message, ...optionalParams);
}
console.warn = function(message?: any, ...optionalParams: any[]) {
  oldWarn.call(this, message, ...optionalParams);
  log.warn(message, ...optionalParams);
}
console.error = function(message?: any, ...optionalParams: any[]) {
  oldError.call(this, message, ...optionalParams);
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