import 'reflect-metadata';
import '../polyfills';

import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { SharedModule } from './shared/shared.module';

import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// NG Translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AgGridModule } from 'ag-grid-angular';

import { HomeModule } from './pages/home/home.module';
import { DetailModule } from './detail/detail.module';

import { AppComponent } from './app.component';
import { AddonTableColumnComponent } from './components/addon-table-column/addon-table-column.component';
import { AddonStatusColumnComponent } from './components/addon-status-column/addon-status-column.component';
import { TitlebarComponent } from './components/titlebar/titlebar.component';
import { FooterComponent } from './components/footer/footer.component';
import { DefaultHeadersInterceptor } from './interceptors/default-headers.interceptor';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    AddonTableColumnComponent,
    AddonStatusColumnComponent,
    TitlebarComponent,
    FooterComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    SharedModule,
    HomeModule,
    DetailModule,
    AppRoutingModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    BrowserAnimationsModule,

  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: DefaultHeadersInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
