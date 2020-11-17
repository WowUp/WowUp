import { Injectable } from "@angular/core";
import { Toc } from "../../models/wowup/toc";
import { FileService } from "../files/file.service";

@Injectable({
  providedIn: "root",
})
export class TocService {
  constructor(private _fileService: FileService) {}

  public async parse(tocPath: string): Promise<Toc> {
    const tocText = await this._fileService.readFile(tocPath);

    return {
      author: this.getValue("Author", tocText),
      curseProjectId: this.getValue("X-Curse-Project-ID", tocText),
      interface: this.getValue("Interface", tocText),
      title: this.getValue("Title", tocText),
      website: this.getValue("Website", tocText),
      version: this.getValue("Version", tocText),
      partOf: this.getValue("X-Part-Of", tocText),
      category: this.getValue("X-Category", tocText),
      localizations: this.getValue("X-Localizations", tocText),
      wowInterfaceId: this.getValue("X-WoWI-ID", tocText),
      dependencies: this.getValue("Dependencies", tocText),
      tukUiProjectId: this.getValue("X-Tukui-ProjectID", tocText),
      tukUiProjectFolders: this.getValue("X-Tukui-ProjectFolders", tocText),
      loadOnDemand: this.getValue("LoadOnDemand", tocText),
    };
  }

  public async parseMetaData(tocPath: string): Promise<string[]> {
    const tocText = await this._fileService.readFile(tocPath);

    return tocText.split("\n").filter((line) => line.trim().startsWith("## "));
  }

  private getValue(key: string, tocText: string): string {
    const match = new RegExp(`^## ${key}:(.*?)$`, "m").exec(tocText);

    if (!match || match.length !== 2) {
      return "";
    }

    return this.stripEncodedChars(match[1].trim());
  }

  private stripEncodedChars(value: string) {
    let str = this.stripColorChars(value);
    str = this.stripNewLineChars(str);

    return str;
  }

  private stripColorChars(value: string) {
    return value.replace(/\|[a-zA-Z0-9]{9}/g, "");
  }

  private stripNewLineChars(value: string) {
    return value.replace(/\|r/g, "");
  }
}
