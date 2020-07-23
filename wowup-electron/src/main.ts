import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Titlebar, Color } from 'custom-electron-titlebar'

import { AppModule } from './app/app.module';
import { AppConfig } from './environments/environment';

if (AppConfig.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    preserveWhitespaces: false
  })
  .catch(err => console.error(err));

new Titlebar({
  backgroundColor: Color.fromHex('#6B69D6'),
  menu: null,
});

document.addEventListener('click', (evt: any) => {
  console.debug('CLICK')
  if (evt.target.tagName === 'A' && evt.target.href.startsWith('http')) {
    event.preventDefault()
  }
})