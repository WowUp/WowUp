import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "invertBool",
})
export class InvertBoolPipe implements PipeTransform {
  public transform(value: boolean): boolean {
    return !value;
  }
}
