import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";

export interface GameVersionMismatchAddon {
  name: string;
  requiredVersion: string;
}

export interface GameVersionMismatchGroup {
  installationName: string;
  gameVersion: string;
  addons: GameVersionMismatchAddon[];
}

export interface GameVersionMismatchDialogData {
  groups: GameVersionMismatchGroup[];
  /** Other addons are being updated too, so skipping these still updates the rest */
  canSkip: boolean;
}

/** What to do with the addons that need a newer game version */
export type GameVersionMismatchChoice = "update" | "ignore" | "skip";

@Component({
  selector: "app-game-version-mismatch-dialog",
  templateUrl: "./game-version-mismatch-dialog.component.html",
  styleUrls: ["./game-version-mismatch-dialog.component.scss"],
})
export class GameVersionMismatchDialogComponent {
  public constructor(@Inject(MAT_DIALOG_DATA) public data: GameVersionMismatchDialogData) {}
}
