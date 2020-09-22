import { NgModule } from "@angular/core";

import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';

@NgModule({
  exports: [
    MatSliderModule,
    MatTabsModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatMenuModule
  ],
  imports: [
    MatSliderModule,
    MatTabsModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatMenuModule
  ]
})
export class MatModule { }