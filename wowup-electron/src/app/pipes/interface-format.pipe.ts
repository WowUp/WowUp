import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "interfaceFormat",
})
export class InterfaceFormatPipe implements PipeTransform {
  transform(value: string, ...args: unknown[]): string {
    if (!value) {
      return value;
    }

    if (value.indexOf(".") !== -1) {
      return value;
    }

    // split the long interface into 3 chunks, major minor patch 
    const chunks = [
      value.substr(0, value.length - 4),
      value.substr(value.length - 4, 2),
      value.substr(value.length - 2, 2),
    ];
    return chunks.map((c) => parseInt(c, 10)).join('.');
  }
}
