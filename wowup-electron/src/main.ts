import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { AppModule } from "./app/app.module";
import { AppConfig } from "./environments/environment";

if (AppConfig.production) {
  enableProdMode();
}

console.log = function (message?: any, ...optionalParams: any[]) {
  window.log.info(message, ...optionalParams);
};
console.warn = function (message?: any, ...optionalParams: any[]) {
  window.log.warn(message, ...optionalParams);
};
console.error = function (message?: any, ...optionalParams: any[]) {
  window.log.error(message, ...optionalParams);
};

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    preserveWhitespaces: false,
  })
  .catch((err) => console.error(err));

// new WowUpTitlebar();

// new Titlebar({
//   backgroundColor: Color.fromHex('#6B69D6'),
//   menu: null,
//   icon: '/assets/wowup_logo_512np.png'
// });

document.addEventListener("click", (evt: any) => {
  if (evt.target.tagName === "A" && evt.target.href.startsWith("http")) {
    evt.preventDefault();
  }
});

// Disable file drop
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => event.preventDefault());
