import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'downloadCount'
})
export class DownloadCountPipe implements PipeTransform {

  transform(value: number, ...args: unknown[]): string {
    let suffix = '';
    let downloadCount = value;
    if (downloadCount >= 1000000000) {
      suffix = "billion";
      downloadCount /= 1000000000.0;
    }
    else if (downloadCount >= 1000000) {
      suffix = "million";
      downloadCount /= 1000000.0;
    }
    else if (downloadCount >= 1000) {
      suffix = "thousand";
      downloadCount /= 1000.0;
    }

    return `${downloadCount.toFixed(0)} ${suffix}`;
  }

}
