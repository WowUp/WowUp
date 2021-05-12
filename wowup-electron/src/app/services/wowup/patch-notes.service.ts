import { Injectable } from "@angular/core";

import * as ChangeLogJson from "../../../assets/changelog.json";
import { ChangeLog } from "../../models/wowup/change-log";

@Injectable({
  providedIn: "root",
})
export class PatchNotesService {
  public changeLogs: ChangeLog[] = [];

  public constructor() {
    this.changeLogs = [...CHANGELOGS, ...ChangeLogJson.ChangeLogs];
  }
}

const CHANGELOGS: ChangeLog[] = [
  {
    Version: "2.3.0",
    html: `<div>
      <h4 style="margin-top: 1em;">New Features</h4>
      <ul>
        <li>Support for new multiple toc file addons from the WowUpHub</li>
      </ul>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>Addons with warnings and ignored will be weighted at the bottom again</li>
        <li>Fix a display issue with selecting the latest game version when installing an addon (right click > re-install)</li>
      </ul>
      </div>`,
  },
  {
    Version: "2.2.1",
    html: `<div>
      <h4 style="margin-top: 1em;">New Features</h4>
      <ul>
        <li>
        <div style="margin-bottom: 0.25em;">WowUp companion data addon name updated (Linaori)</div>
        <img style="max-width: 90%; margin-bottom: 1em" class="mat-elevation-z8" src="https://user-images.githubusercontent.com/1754678/117027014-923adf80-acfc-11eb-8127-c3c8c4564df5.png">
        </li>
        <li>Classic PTR client is now treated like a Burning Crusade client</li>
        <li>Addons in Warning state will now be at the top when sorting by status on My Addons tab</li>
        <li>Author names lists will now wrap on My Addons tab</li>
        <li>
        <div style="margin-bottom: 0.25em;">Added the installation name to the sync error toast</div>
        <img style="max-width: 50%; margin-bottom: 1em" class="mat-elevation-z8" src="https://user-images.githubusercontent.com/20467484/117684549-b8d49c80-b17a-11eb-8792-d38aa1267f51.png">
        </li>
        <li>Tweaked the automatic column widths for My Addons tab</li>
        <li>When adding/removing an addon the count text should update again</li>
        <li>When performing a re-scan the latest addon info should be fetched once again</li>
        <li>Http circuit breaker will no longer trip for 404s</li>
        </li>
      </ul>
      </div>`,
  },
  {
    Version: "2.2.0",
    html: `<div>
      <h4>Locale Updates</h4>
      <ul>
        <li>Korean locale updates (Jaehyuk-Lee)</li>
        <li>German locale updates (Glow/maestrohdude)</li>
        <li>Spanish locale updates (SkollVargr)</li>
        <li>Chinese locale updates (CyanoHao)</li>
        <li>Russian locale updates (Medok)</li>
      </ul>
      <h4 style="margin-top: 1em;">New Features</h4>
      <ul>
        <li>
        <div style="margin-bottom: 0.25em;">Add category browsing support for CurseForge and TukUI (Strayge)</div>
        <img style="height: 200px; margin-bottom: 1em" class="mat-elevation-z8" src="http://cdn.wowup.io/client/2.2.0/categories-1.png">
        </li>
        <li>Add new logging for addon updating (Linaori)</li>
        <li>
        <div style="margin-bottom: 0.25em;">Add support for CurseForge install links via app settings (Noxis)</div>
        <img style="height: 200px; margin-bottom: 1em" class="mat-elevation-z8" src="http://cdn.wowup.io/client/2.2.0/curse-install-1.png">
        </li>
        <li>Add a button to remove an addon via the addon details dialog</li>
        <li>
        <div style="margin-bottom: 0.25em;">Add new detection for addons that have been removed by their provider</div>
        <img style="width: 400px; max-width: 100%; margin-bottom: 1em" class="mat-elevation-z8" src="http://cdn.wowup.io/client/2.2.0/addon-warning-1.png">
        </li>
        <li>
        <div style="margin-bottom: 0.25em;">All new handling of World of Warcraft client installations</div>
        <img style="height: 200px; max-width: 100%; margin-bottom: 1em" class="mat-elevation-z8" src="http://cdn.wowup.io/client/2.2.0/wow-installations-1.png">
        </li>
        <li>Add an advanced feature for symlinks in your addon folder via app settings</li>
        <li>
        <div style="margin-bottom: 0.25em;">Add initial support for Burning Crusade beta client</div>
        <img style="height: 200px; max-width: 100%; margin-bottom: 1em" class="mat-elevation-z8" src="http://cdn.wowup.io/client/2.2.0/wow-tbc-logo.jpg">
        </li>
      </ul>
      <h4 style="margin-top: 1em;">Bug Fixes/Tweaks</h4>
      <ul>
        <li>Clicking the desktop notification will now focus the app</li>
        <li>Improve formatting for changelogs and descriptions</li>
        <li>Rework the sorting of the Get Addons tab</li>
        <li>Switch to a new grid library, improved performance for your lists</li>
        <li>System bar icon will now change per system theme setting on Mac</li>
        <li>Fix an issue with unzipped folders permissions on Mac</li>
        <li>Fix an issue with update all clients button being disabled when selected client had no updates</li>
        <li>Fix an issue with not rolling back an addon update when unzipping fails</li>
        <li>Fix an issue with rotating download links not being updated in the json store</li>
        <li>Fix an issue with Check Updates not checking all installations</li>
        <li>Fix an issue with Scanning ignoring disabled addon providers</li>
        <li>Fix a memory leak issue when checking for updates</li>
      </ul>
      </div>`,
  },
];
