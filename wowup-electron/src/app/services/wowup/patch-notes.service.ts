import { Injectable } from "@angular/core";

import ChangeLogJson from "../../../assets/changelog.json";
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
    Version: "2.9.0",
    html: `
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
    <li>Add new support for the Wrath of the Lich King Classic Beta client</li>
    <li>Add new logo for the Dragonflight Beta client</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
    <li>Chinese locale updates (CyanoHao)</li>
    </ul>
    `,
  },
  {
    Version: "2.8.3",
    html: `
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
    <li>App bundle now much smaller (CyanoHao)</li>
    <li>GitHub personal access tokens now supported</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
    <li>Allow removal of addons that had their dirs removed prior to delete (Linaori)</li>
    <li>Curse addon provider removed</li>
    <li>CurseV2 addon provider removed</li>
    <li>GitHub update check should now attempt to use release.json</li>
    <li>GitHub should now respect release channels better</li>
    <li>Spanish locale updates (SkollVargr)</li>
    <li>Polish locale updates (nydas3k)</li>
    <li>Chinese locale updates (CyanoHao)</li>
    <li>German locale updates (Glow)</li>
    <li>Hardware media keys no longer captured from media ads</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
    <li>Allow removing of addons with no directories (Linaori)</li>
    <li>Fix some text wrapping issues on the addon context menu</li>
    <li>Fix an issue with some GitHub repos</li>
    <li>Fix an issue with saved window position breaking things</li>
    <li>Fix an issue showing wrath Github releases as retail</li>
    <li>Add a confirmation prompt every time Wago is enabled</li>
    </ul>
    `,
  },
  {
    Version: "2.7.1",
    html: `
    <h2 class="text-warning">Important CurseForge Changes</h2>
    <p>
    CurseForge will soon end the ability for WowUp to show or update their addons.<br>
    Read more about how to migrate your addons as best we can on our website.<br>
    <a href="https://wowup.io/guide/wowup/curseforge-migration">Read more here</a>
    </p>
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
    <li>New Application option to remember the last selected details tab or not. (EpicDenmos)</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
    <li>German locale updates (Glow)</li>
    <li>Russian locale updates (Medok, Valdemar)</li>
    <li>Spanish locale updates (SkollVargr)</li>
    <li>Chinese locale updates (CyanoHao)</li>
    <li>Polish locale updates (nydas3k)</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
    <li>Get Addons search text now behaves in a more normal feeling way</li>
    <li>CurseForge V2 is now disabled by default</li>
    <li>Addon details install button now shows unavailable when addon is blocked</li>
    <li>Wago ad frame has a progressive backoff for error catching</li>
    </ul>`,
  },
  {
    Version: "2.7.0",
    html: `
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
    <li>New Polish language support (nydas3k)</li>
    <li>New support for installing from the <a appExternalLink href="https://wowup.io">WowUp website</a></li>
    <li>New CurseForge V2 addon provider</li>
    <li>New copy news link button</li>
    <li>GitHub/Zip addons should now survive a re-scan</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
    <li>German locale updates (Glow)</li>
    <li>Portuguese locale updates (TheLastDarkthorne)</li>
    <li>Russian locale updates (Medok)</li>
    <li>Spanish locale updates (SkollVargr)</li>
    <li>Chinese locale updates (CyanoHao)</li>
    <li>Wago is now a trusted domain by default (Artemis)</li>
    <li>Installing via GitHub URL is now more aggressive</li>
    <li>Addon detail/changelog text is now selectable</li>
    <li>Re-scanning addons is now faster</li>
    <li>Addons with folder name/toc mismatches will now be marked with a warning</li>
    <li>Middle clicking a website link will no longer open the link in a WowUp window</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
    <li>Light theme can be read again</li>
    <li>Fixed an issue with Wago provider not working properly on Mac</li>
    <li>Fix an issue with caching Wago scan results</li>
    <li>Wago addon IDs should now work as expected when swapping providers</li>
    <li>Fix an issue with showing the wrong folder name for some TukUI addons</li>
    <li>Fix an issue with desktop notifications appearing if they were disabled</li>
    <li>Fix an issue with install direct zip URL not working</li>
    <li>Fix an issue with unmatched addons breaking the re-scan process</li>
    <li>Github install supports _classic, _vanilla, _tbc, _bc, and _bcc zip files</li>
    <li>Github install supports octet stream content type zips</li>
    <li>Spinner is now shown during scan at app startup</li>
    <li>My Addons spinner is now centered</li>
    <li>Updated a bunch of dependencies</li>
    </ul>`,
  },
  {
    Version: "2.6.2",
    html: `
    <h4>Fixes</h4>
    <ul>
    <li>Fixed an issue with Wago addons updating incorrectly</li>
    </ul>`,
  },
  {
    Version: "2.6.1",
    html: `
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
    <li>Chinese locale updates (CyanoHao)</li>
    <li>Russian locale updates (Medok)</li>
    <li>Spanish locale updates (SkollVargr)</li>
    <li>Added the ability to collapse the sidebar if no ad is required</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
    <li>Fixed an issue with having no clients locking up the app</li>
    </ul>
    `,
  },
  {
    Version: "2.6.0",
    html: `
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
    <li>Added the ability to automatically discover WoW installs for Lutris users (fultonm)</li>
    <li>
      <div>Added the new <a appExternalLink href="https://addons.wago.io/">Wago.io</a> addon provider</div>
      <a appExternalLink href="https://addons.wago.io/">
        <img src="https://cdn.wowup.io/images/wago-logo.svg" style="width: 100px; border-radius: 4px;" />
      </a> 
    </li>
    <li>
      <div>New app layout courtesy of our friends at <a appExternalLink href="https://www.warcrafttavern.com">Warcraft Tavern</a>.</div>
      <a appExternalLink href="https://www.warcrafttavern.com">
        <img style="width: 200px;" loading="lazy" src="https://www.warcrafttavern.com/wp-content/uploads/2020/10/Warcraft-Tavern-Logo-768x246.png">
      </a>
    </li>
    <li>Added the ability to switch to Beta build release channel from the app</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
    <li>Spanish locale updates (SkollVargr)</li>
    <li>Chinese locale updates (CyanoHao)</li>
    <li>Russian locale updates (Medok)</li>
    <li>German locale updates (Glow)</li>
    <li>Updated At text on the My Addons page should now keep itself up to date</li>
    <li>Modified the GitHub install by URL feature to be more flexible for multi-toc addons</li>
    <li>App now starts up much faster</li>
    <li>Increased the timeout for the CurseForge provider</li>
    <li>Simplify Re-Scan logic</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
    <li>Fixed an issue with some addon IDs colliding between addon providers</li>
    <li>Fixed an issue with a provider being able to block update checks</li>
    <li>Fixed an issue with restoring the window from a pinned shortcut on the taskbar</li>
    <li>Try to fix the issue with duplicated addons</li>
    </ul>`,
  },
  {
    Version: "2.5.2",
    html: `
    <h4 style="margin-top: 1em;">Hotfix</h4>
    <ul>
    <li>Fix an issue with the guide url going to the wrong domain</li>
    </ul>`,
  },
  {
    Version: "2.5.1",
    html: `
    <h4 style="margin-top: 1em;">Hotfix</h4>
    <ul>
    <li>Update the Windows signing cert</li>
    <li>Fix an issue with the app locking up on startup sometimes</li>
    <li>Fix an issue with the import dialog failing to create an import string</li>
    </ul>
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
      <li>Added the ability to turn off system notifications for individual addons (tellier-dev)</li>
      <li>Added the ability to remove addons from the details dialog on Get Addons tab (tellier-dev)</li>
      <li>
        <div>Added the ability to import/export a list of addons for a WoW client. The first step in backing up your list of addons or sharing them with your friends!</div>
        <img style="width: 70%; border: 1px solid #666666; border-radius: 4px;" loading="lazy" src="assets/images/patch/import-export-preview.png">
      </li>
      <li>
        <div>Added the ability to create and restore backups, this is a work in progress.</div>
        <img style="width: 70%; border: 1px solid #666666; border-radius: 4px;" loading="lazy" src="assets/images/patch/backup-preview.png">
      </li>
      <li>Added a button to open the client folder for a WoW install</li>
      <li>Added WowUpHub category support</li>
      <li>Added WowUpHub preview support</li>
      <li>Added Mac M1 builds</li>
      <li>Added support for more multi-toc suffixes</li>
      <li>Added support for Classic Era PTR client</li>
      <li>Added some badges to indicate number of updates and which client needs them</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Fix an issue with addons being ignored by TukUI too early during a scan</li>
      <li>Fix an issue with certain addons not being able to be re-scanned</li>
      <li>Fix an issue with updating the same addon in multiple WoW clients at the same time</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
      <li>Spanish locale updates (SkollVargr)</li>
      <li>Chinese locale updates (CyanoHao)</li>
      <li>Russian locale updates (Medok)</li>
      <li>German locale updates (Glow)</li>
      <li>Tweak the tabs some more</li>
      <li>Performance improvements for My Addons page</li>
      <li>Images details tab is now Previews</li>
      <li>Use a different lightbox library for previews</li>
      <li>Expanded system proxy support</li>
    </ul>`,
  },
  {
    Version: "2.5.0",
    html: `
    <div>
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
      <li>Added the ability to turn off system notifications for individual addons (tellier-dev)</li>
      <li>Added the ability to remove addons from the details dialog on Get Addons tab (tellier-dev)</li>
      <li>
        <div>Added the ability to import/export a list of addons for a WoW client. The first step in backing up your list of addons or sharing them with your friends!</div>
        <img style="width: 70%; border: 1px solid #666666; border-radius: 4px;" loading="lazy" src="assets/images/patch/import-export-preview.png">
      </li>
      <li>
        <div>Added the ability to create and restore backups, this is a work in progress.</div>
        <img style="width: 70%; border: 1px solid #666666; border-radius: 4px;" loading="lazy" src="assets/images/patch/backup-preview.png">
      </li>
      <li>Added a button to open the client folder for a WoW install</li>
      <li>Added WowUpHub category support</li>
      <li>Added WowUpHub preview support</li>
      <li>Added Mac M1 builds</li>
      <li>Added support for more multi-toc suffixes</li>
      <li>Added support for Classic Era PTR client</li>
      <li>Added some badges to indicate number of updates and which client needs them</li>
    </ul>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Fix an issue with addons being ignored by TukUI too early during a scan</li>
      <li>Fix an issue with certain addons not being able to be re-scanned</li>
      <li>Fix an issue with updating the same addon in multiple WoW clients at the same time</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
      <li>Spanish locale updates (SkollVargr)</li>
      <li>Chinese locale updates (CyanoHao)</li>
      <li>Russian locale updates (Medok)</li>
      <li>German locale updates (Glow)</li>
      <li>Tweak the tabs some more</li>
      <li>Performance improvements for My Addons page</li>
      <li>Images details tab is now Previews</li>
      <li>Use a different lightbox library for previews</li>
      <li>Expanded system proxy support</li>
    </ul>`,
  },
  {
    Version: "2.4.7",
    html: `
    <div>
    <h4 style="margin-top: 1em;">New Features</h4>
    <ul>
      <li>Add support for automatic detection of new Classic Era PTR client</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
      <li>Russian locale updates (Medok)</li>
      <li>Spanish locale updates (SkollVargr)</li>
      <li>Chinese locale updates (CyanoHao)</li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.6",
    html: `
    <div>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Update Electron to 13.5.1 to fix the <a appExternalLink style="" href="https://github.com/electron/electron/issues/31212">TukUI download issue</a></li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.5",
    html: `
    <div>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Fix an issue with Google Drive preventing files from being deleted</li>
      <li>Fix an issue with checking addon owners against the block list</li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.4",
    html: `
    <div>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Fix an issue with single CurseForge addons failing, causing the whole batch of addons to be marked "Unknown"</li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.3",
    html: `
    <div>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Fix an issue with auto updates failing with the same addon installed in multiple WoW clients</li>
      <li>Fix an caching issue with CurseForge featured addons</li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.2",
    html: `
    <div>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>Updating the app badge should now properly check the setting</li>
    </ul>
    <h4 style="margin-top: 1em;">Changes</h4>
    <ul>
      <li>Reduce the cache time of featured addons responses</li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.1",
    html: `
    <div>
    <h4 style="margin-top: 1em;">Fixes</h4>
    <ul>
      <li>The app badge toggle option is now visible for all operating systems</li>
      <li>When changing the Ignore state on an addon the app badge should update</li>
    </ul>
    </div>`,
  },
  {
    Version: "2.4.0",
    html: `<div>
      <h4 style="margin-top: 1em;">New Features</h4>
      <ul>
        <li>
        <div>Added a news section powered by</div>
        <a appExternalLink href="https://www.warcrafttavern.com">
        <img style="width: 200px;" loading="lazy" src="https://www.warcrafttavern.com/wp-content/uploads/2020/10/Warcraft-Tavern-Logo-768x246.png">
        </a>
        </li>
        <li>New Images tab in the addon details dialog</li>
        <li>You can now change the order of your WoW installations</li>
        <li>Added an optional app badge notification with the count of available updates for Mac and Linux users</li>
        <li>Get Addons tab will now include a list of recently updated addons from WowUpHub</li>
        <li>When opening an external link you can now trust the domain to avoid being prompted again</li>
      </ul>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>Russian locale updates (Medok)</li>
        <li>German locale updates (Glow)</li>
        <li>Spanish locale updates (SkollVargr)</li>
        <li>Chinese locale updates (CyanoHao)</li>
        <li>Italian locale updates (Bito)</li>
        <li>Revamped UI</li>
        <li>WowUp updates will now download automatically</li>
        <li>Optimize update checks for WowUpHub and CurseForge providers, now faster</li>
        <li>When starting with 0 installs found, user should go to installations page</li>
        <li>Update Angular and Electron to latest</li>
      </ul>
      <h4 style="margin-top: 1em;">Fixes</h4>
      <ul>
        <li>Fixed an issue with table header font in addon details</li>
        <li>Fixed an issue with odd table de-select behavior</li>
        <li>Fixed an issue with the client selector overlapping the top toolbar</li>
        <li>Fixed an issue with re-scanning not showing the correct game version</li>
        <li>Fixed an issue with Update All button sometimes getting stuck enabled</li>
        <li>Fixed an issue with CurseForge categories throwing an error</li>
        <li>Fixed an issue with addons showing up with a blank version from WowUpHub in Get Addons</li>
        <li>Fixed several issues with light themes</li>
        <li>Reworked the app update flow</li>
      </ul>
      </div>`,
  },
  {
    Version: "2.3.4",
    html: `<div>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>Fix the numpad zoom in/out shortcuts</li>
      </ul>
      </div>`,
  },
  {
    Version: "2.3.3",
    html: `<div>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>Undo the CurseForge tweak, caused too many issues</li>
      </ul>
      </div>`,
  },
  {
    Version: "2.3.2",
    html: `<div>
      <h4 style="margin-top: 1em;">New Features</h4>
      <ul>
        <li>Numpad keys can now be used to control zoom</li>
      </ul>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>Russian locale updates (Medok)</li>
        <li>Scanning should now be more accurate</li>
        <li>Tweak some CurseForge matching</li>
        <li>Reduce the time that searches are cached</li>
        <li>Sorting by columns other than name should now fall back to case insensitive names</li>
      </ul>
      </div>`,
  },
  {
    Version: "2.3.1",
    html: `<div>
      <h4 style="margin-top: 1em;">New Features</h4>
      <ul>
        <li>Installing from a GitHub URL now supports the new BigWigs metadata file</li>
        <li>Installing from a GitHub URL now supports -bcc zip files when a Burning Crusade client is selected</li>
        <li>The Get Addons tab will now also list Recently Added addons from CurseForge, just sort by the 'Released At' column</li>
      </ul>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>German locale updates (Glow)</li>
        <li>Chinese locale updates (CyanoHao)</li>
        <li>Spanish locale updates (SkollVargr)</li>
        <li>Using the WowUp Addon should no longer cause the Battle.net app to say "Updating" for all clients (Linaori)</li>
        <li>When re-scanning the "Released At" date should be more accurate</li>
        <li>Can no longer drag columns on "My Addons" and "Get Addons" off the screen</li>
        <li>Sorting by name is no longer case sensitive</li>
        <li>Sorting by name on "My Addons" and "Get Addons" is no longer case sensitive</li>
        <li>Long author names will now attempt to wrap all text</li>
        <li>WowUp addon companion data now has it's own provider name</li>
        <li>The WowUp addon companion data row should now be kept up to date without a re-scan</li>
        <li>A success toast will now be shown when an addon is successfully removed</li>
        <li>Optimize fetching of WowInterface data</li>
      </ul>
      </div>`,
  },
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
        <li>Addons from the WowUpHub will now show author names from their respective toc files where applicable</li>
        <li>Addons that are no longer supported by a client sourced from the WowUpHub will now be marked with a warning, not throw an error</li>
        <li>Fix a display issue with selecting the latest game version when installing an addon (right click > re-install)</li>
        <li>Fix an issue with the interface version being displayed in the Game Version column after a re-scan</li>
        <li>Fix an issue with curse matches being ignored when they have no matching client type releases during a re-scan</li>
        <li>Fix an issue with over aggressive TukUI name matching during a re-scan</li>
        <li>Fix an issue Classic Era being incorrectly identified when adding it manually</li>
        </ul>
      </div>`,
  },
  {
    Version: "2.2.2",
    html: `<div>
      <h4 style="margin-top: 1em;">Changes</h4>
      <ul>
        <li>Fix some issues related to addons migrating from classic to TBC / Multiple toc files</li>
        <li>Improve TukUI searching</li>
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
        <img style="max-width: 90%; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="https://user-images.githubusercontent.com/1754678/117027014-923adf80-acfc-11eb-8127-c3c8c4564df5.png">
        </li>
        <li>Classic PTR client is now treated like a Burning Crusade client</li>
        <li>Addons in Warning state will now be at the top when sorting by status on My Addons tab</li>
        <li>Author names lists will now wrap on My Addons tab</li>
        <li>
        <div style="margin-bottom: 0.25em;">Added the installation name to the sync error toast</div>
        <img style="max-width: 50%; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="https://user-images.githubusercontent.com/20467484/117684549-b8d49c80-b17a-11eb-8792-d38aa1267f51.png">
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
        <img style="height: 200px; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="http://cdn.wowup.io/client/2.2.0/categories-1.png">
        </li>
        <li>Add new logging for addon updating (Linaori)</li>
        <li>
        <div style="margin-bottom: 0.25em;">Add support for CurseForge install links via app settings (Noxis)</div>
        <img style="height: 200px; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="http://cdn.wowup.io/client/2.2.0/curse-install-1.png">
        </li>
        <li>Add a button to remove an addon via the addon details dialog</li>
        <li>
        <div style="margin-bottom: 0.25em;">Add new detection for addons that have been removed by their provider</div>
        <img style="width: 400px; max-width: 100%; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="http://cdn.wowup.io/client/2.2.0/addon-warning-1.png">
        </li>
        <li>
        <div style="margin-bottom: 0.25em;">All new handling of World of Warcraft client installations</div>
        <img style="height: 200px; max-width: 100%; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="http://cdn.wowup.io/client/2.2.0/wow-installations-1.png">
        </li>
        <li>Add an advanced feature for symlinks in your addon folder via app settings</li>
        <li>
        <div style="margin-bottom: 0.25em;">Add initial support for Burning Crusade beta client</div>
        <img style="height: 200px; max-width: 100%; margin-bottom: 1em" class="mat-elevation-z8" loading="lazy" src="http://cdn.wowup.io/client/2.2.0/wow-tbc-logo.jpg">
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
