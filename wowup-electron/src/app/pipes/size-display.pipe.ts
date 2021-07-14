import { Pipe, PipeTransform } from "@angular/core";
import { formatSize } from "../utils/number.utils";

@Pipe({ name: "sizeDisplay" })
export class SizeDisplayPipe implements PipeTransform {
  public constructor() {}

  public transform(size: number): string {
    return formatSize(size);
  }
}
