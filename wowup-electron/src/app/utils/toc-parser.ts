import { promisify } from 'util';
import { FileUtils } from './file.utils';
import * as fs from 'fs';
import { Toc } from 'app/models/wowup/toc';

const readFileAsync = promisify(fs.readFile);

export class TocParser {

  private readonly _tocPath: string;
  private _tocText: string;

  private get newLineRegex() {
    return;
  }

  constructor(tocPath: string) {
    this._tocPath = tocPath;
  }

  public async parse(): Promise<Toc> {
    this._tocText = fs.readFileSync(this._tocPath, { encoding: 'utf-8' })

    return {
      author: this.getValue('Author'),
      curseProjectId: this.getValue('X-Curse-Project-ID'),
      interface: this.getValue('Interface'),
      title: this.getValue('Title'),
      website: this.getValue('Website'),
      version: this.getValue('Version'),
      partOf: this.getValue('X-Part-Of'),
      category: this.getValue('X-Category'),
      localizations: this.getValue('X-Localizations'),
      wowInterfaceId: this.getValue('X-WoWI-ID'),
      dependencies: this.getValue('Dependencies'),
    };
  }

  public parseMetaData(): string[] {
    this._tocText = fs.readFileSync(this._tocPath, { encoding: 'utf-8' })

    return this._tocText
      .split('\n')
      .filter(line => line.trim().startsWith('## '));
  }

  private getValue(key: string): string {
    const match = new RegExp(`^## ${key}:(.*?)$`, 'm').exec(this._tocText);

    if (!match || match.length !== 2) {
      return '';
    }

    return this.stripEncodedChars(match[1].trim());
  }

  private stripEncodedChars(value: string) {
    let str = this.stripColorChars(value);
    str = this.stripNewLineChars(str);

    return str;
  }

  private stripColorChars(value: string) {
    return value.replace(/\|[a-zA-Z0-9]{9}/g, '');
  }

  private stripNewLineChars(value: string) {
    return value.replace(/\|r/g, '');
  }
}