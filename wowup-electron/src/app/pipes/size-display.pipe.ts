import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "sizeDisplay" })
export class SizeDisplayPipe implements PipeTransform {
  public constructor() {}

  public transform(size: number): string {
    if (size < 1024) {
      return `${size} bytes`;
    }

    const sizeKb = Math.round(size / 1024);
    if (sizeKb < 1024) {
      return `${sizeKb} kb`;
    }

    const sizeMb = Math.round(size / 1024 / 1024);
    return `${sizeMb} mb`;
  }
}
