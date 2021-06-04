import { Injectable } from "@angular/core";

interface DirectiveData {
  type: string
  arguments: string[]
}

interface DirectiveTemplate {
  transform(line: string) : DirectiveData | null;
}

class IdDirective implements DirectiveTemplate {
  transform(line: string): DirectiveData | null {
    if (line.indexOf("ID") !== 0) {
      return null;
    }

    return {
      type: "ID",
      arguments: [line.substring(2, line.length).trim()],
    } as DirectiveData;
  }
}

class NameDirective implements DirectiveTemplate {
  transform(line: string): DirectiveData | null {
    if (line.indexOf("NAME") !== 0) {
      return null;
    }

    return {
      type: "NAME",
      arguments: [line.substring(4, line.length).trim()],
    } as DirectiveData;
  }
}

class ClientDirective implements DirectiveTemplate {
  transform(line: string): DirectiveData | null {
    if (line.indexOf("CLIENT") !== 0) {
      return null;
    }

    const lineArguments = line.substring(6, line.length)
      .trim()
      .split(" ")
      .map(v => v.toLowerCase());

    return {
      type: "CLIENT",
      arguments: lineArguments,
    } as DirectiveData;
  }
}

class AddonDirective implements DirectiveTemplate {
  transform(line: string): DirectiveData | null {
    if (line.indexOf("ADDON") !== 0) {
      return null;
    }

    const lineArguments = line.substring(5, line.length).trim().split(" ");

    if (lineArguments.length > 2 || lineArguments.length === 0) {
      throw new Error("ADDON must have 1 or 2 arguments");
    }

    return {
      type: "ADDON",
      arguments: lineArguments,
    } as DirectiveData;
  }
}

@Injectable({
  providedIn: "root",
})
export class PackParser {
  private _directiveTemplates: DirectiveTemplate[] = [
    new IdDirective(),
    new NameDirective(),
    new ClientDirective(),
    new AddonDirective(),
  ];

  public parse(input: string): DirectiveData[] {
    return input.split(/\r?\n/g)
      .map(line => line.trim())
      .reduce((carry: DirectiveData[], line) => {
        if (line === "" || line.charAt(0) === '#') {
          return carry;
        }

        for (const directiveTemplate of this._directiveTemplates) {
          const directive = directiveTemplate.transform(line);
          if (directive !== null) {
            carry.push(directive);

            return carry;
          }
        }

        throw new Error("Cannot parse directive line: " + line);
      }, []);
  }
}
