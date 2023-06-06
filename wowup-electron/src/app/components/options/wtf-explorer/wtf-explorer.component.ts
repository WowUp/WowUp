import * as _ from "lodash";
import { BehaviorSubject, from, of } from "rxjs";
import { catchError, first, tap } from "rxjs/operators";

import { Component, Input, OnDestroy, OnInit } from "@angular/core";

import { ElectronService } from "../../../services";
import { WarcraftService } from "../../../services/warcraft/warcraft.service";
import { WtfNode, WtfService } from "../../../services/wtf/wtf.service";
import { removeExtension } from "../../../utils/string.utils";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { formatSize } from "../../../utils/number.utils";
import { AddonFolder } from "wowup-lib-core";
import { WowInstallation } from "wowup-lib-core/lib/models";
import { FlatTreeControl } from "@angular/cdk/tree";
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";

interface SavedVariable {
  name: string;
  size: number;
  hasAddon: boolean;
}

interface Server {
  name: string;
  size: number;
  sizeMb: string;
  characters: Character[];
}

interface Character {
  name: string;
  size: number;
  sizeMb: string;
  variables: SavedVariable[];
}

interface AccountItem {
  name: string;
  globalVariables: SavedVariable[];
  servers: Server[];
  size: number;
  sizeMb: string;
}

interface NodeModel {
  name: string;
  isLua: boolean;
  ignore: boolean;
  hasAddon: boolean;
  children?: NodeModel[];
}

interface TreeNode {
  name: string;
  children?: TreeNode[];
  warn: boolean;
  ignore: boolean;
}

interface FlatTreeNode {
  expandable: boolean;
  name: string;
  level: number;
  ignore: boolean;
  warn: boolean;
}

@Component({
  selector: "app-wtf-explorer",
  templateUrl: "./wtf-explorer.component.html",
  styleUrls: ["./wtf-explorer.component.scss"],
})
export class WtfExplorerComponent implements OnInit, OnDestroy {
  @Input("tabIndex") public tabIndex!: number;

  @Input()
  public get active(): boolean {
    return this._active;
  }
  public set active(active: boolean) {
    this._active = active;
    if (this._active) {
      this.lazyLoad();
    }
  }
  private _active = false;

  public accountMap = new BehaviorSubject<AccountItem[]>([]);
  public loading$ = new BehaviorSubject<boolean>(false);
  public error$ = new BehaviorSubject<string>("");
  public nodes$ = new BehaviorSubject<NodeModel[]>([]);
  public installations: WowInstallation[] = [];
  public selectedInstallationId = "";
  public wtfPath = "";

  public get selectedInstallationLabel(): string {
    return this.installations.find((inst) => inst.id === this.selectedInstallationId)?.displayName ?? "";
  }

  private _treeTransformer = (node: TreeNode, level: number): FlatTreeNode => {
    return {
      expandable: Array.isArray(node.children) && node.children.length > 0,
      level,
      name: node.name,
      ignore: node.ignore,
      warn: node.warn,
    };
  };

  public treeControl = new FlatTreeControl<FlatTreeNode>(
    (node) => node.level,
    (node) => node.expandable
  );

  public treeFlattener = new MatTreeFlattener(
    this._treeTransformer,
    (node) => node.level,
    (node) => node.expandable,
    (node) => node.children
  );

  public treeDataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  public constructor(
    public electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _wtfService: WtfService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public getClientName(installation: WowInstallation): Promise<string> {
    return this._warcraftInstallationService.getInstallationDisplayName(installation);
  }

  public onClientChange(): void {
    const installation = this.installations.find((inst) => inst.id === this.selectedInstallationId);

    this.wtfPath = this._wtfService.getWtfPath(installation);

    // from(this.loadAccounts(installation))
    //   .pipe(first())
    //   .subscribe((accounts) => {
    //     this.accountMap.next(accounts);
    //   });

    from(this.loadWtfStructure(installation)).pipe(first()).subscribe();
  }

  public onClickRefresh(): void {
    this.onClientChange();
  }

  public hasChild = (_: number, node: FlatTreeNode) => node.expandable;

  private lazyLoad() {
    this.loading$.next(true);
    this.error$.next("");
    from(this._warcraftInstallationService.getWowInstallationsAsync())
      .pipe(
        first(),
        tap((installations) => {
          this.installations = installations;

          const installation = this.installations[0];
          this.selectedInstallationId = installation?.id ?? "";

          this.wtfPath = this._wtfService.getWtfPath(installation);

          return from(this.loadWtfStructure(installation));
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();

    // from(this.loadAccounts(installation))
    //   .pipe(first())
    //   .subscribe((accounts) => {
    //     this.accountMap.next(accounts);
    //   });
  }

  private async loadWtfStructure(installation: WowInstallation) {
    this.loading$.next(true);
    this.error$.next("");
    this.treeDataSource.data = [];

    try {
      const addonFolders = await this._warcraftService.listAddons(installation);
      const wtfTree = await this._wtfService.getWtfContents(installation);

      this.treeDataSource.data = this.createTreeNodes(wtfTree.children, addonFolders);
      console.log("treeNodes", this.treeDataSource.data);

      // this.nodes$.next(wtfTree.children.map((tn) => this.getNode(tn, addonFolders)));
    } catch (e) {
      console.error(e);
      this.error$.next(e.message as string);
    } finally {
      this.loading$.next(false);
    }
  }

  private createTreeNodes(wtfNodes: WtfNode[], addonFolders: AddonFolder[]): TreeNode[] {
    const treeNodes: TreeNode[] = [];

    wtfNodes.forEach((wtfNode) => {
      let name = `${wtfNode.name} (${formatSize(wtfNode.size)})`;
      if (wtfNode.isDirectory) {
        name = `${wtfNode.name} (${wtfNode.children.length} files ${formatSize(wtfNode.size)})`;
      }

      const treeNode: TreeNode = {
        name,
        children: this.createTreeNodes(wtfNode.children, addonFolders),
        warn: false,
        ignore: wtfNode.ignore,
      };

      if (!wtfNode.ignore && wtfNode.isLua) {
        treeNode.warn = !this.addonFolderExists(treeNode.name, addonFolders);
      }

      treeNodes.push(treeNode);
    });

    return treeNodes;
  }

  private getNode(treeNode: WtfNode, addonFolders: AddonFolder[]): NodeModel {
    let name = `${treeNode.name} (${formatSize(treeNode.size)})`;
    if (treeNode.isDirectory) {
      name = `${treeNode.name} (${treeNode.children.length} files ${formatSize(treeNode.size)})`;
    }
    const nodeModel: NodeModel = {
      name: name,
      children: treeNode.children.map((tn) => this.getNode(tn, addonFolders)),
      hasAddon: false,
      isLua: treeNode.isLua,
      ignore: treeNode.ignore,
    };

    if (treeNode.isLua) {
      nodeModel.hasAddon = this.addonFolderExists(treeNode.name, addonFolders);
    }

    return nodeModel;
  }

  private addonFolderExists(fileName: string, addonFolders: AddonFolder[]): boolean {
    return addonFolders.some((af) => af.name === removeExtension(fileName));
  }

  private async loadAccounts(installation: WowInstallation): Promise<AccountItem[]> {
    try {
      if (!installation) {
        return [];
      }

      const accounts = await this._wtfService.getAccounts(installation);
      const addonFolders = await this._warcraftService.listAddons(installation);

      const accountMap: AccountItem[] = [];
      for (const account of accounts) {
        const accountGlobalVars = await this.getAccountGlobalVars(installation, account, addonFolders);
        const serverList = await this.getServers(installation, account, addonFolders);
        console.debug("serverList", serverList);

        const totalSize = _.sumBy(accountGlobalVars, (gvar) => gvar.size);
        accountMap.push({
          globalVariables: accountGlobalVars,
          name: account,
          size: totalSize,
          sizeMb: (totalSize / 1024 / 1024).toFixed(2),
          servers: serverList,
        });
      }

      return accountMap;
    } catch (e) {
      console.error(e);
      this.error$.next(e.message as string);
      return [];
    } finally {
      this.loading$.next(false);
    }
  }

  private async getAccountGlobalVars(
    installation: WowInstallation,
    account: string,
    addonFolders: AddonFolder[]
  ): Promise<SavedVariable[]> {
    const globalVariables = await this._wtfService.getGlobalVariables(installation, account);
    const gVars: SavedVariable[] = globalVariables.map((gv) => {
      return {
        hasAddon: addonFolders.some((af) => af.name === removeExtension(gv.name)),
        name: gv.name,
        size: gv.stats.size,
      };
    });

    return gVars;
  }

  private async getServers(
    installation: WowInstallation,
    account: string,
    addonFolders: AddonFolder[]
  ): Promise<Server[]> {
    const serverNames = await this._wtfService.getServers(installation, account);
    const servers: Server[] = serverNames.map((server) => {
      return {
        name: server,
        characters: [],
        size: 0,
        sizeMb: "",
      };
    });

    for (const server of servers) {
      const charNames = await this._wtfService.getCharacters(installation, account, server.name);
      const chars: Character[] = [];
      for (const charName of charNames) {
        const variables = await this.getCharacterSavedVariables(
          installation,
          account,
          server.name,
          charName,
          addonFolders
        );
        const totalSize = _.sumBy(variables, (svar) => svar.size);

        chars.push({
          name: charName,
          size: totalSize,
          sizeMb: (totalSize / 1024 / 1025).toFixed(2),
          variables,
        });
      }

      server.characters = chars;
      server.size = _.sumBy(server.characters, (char) => char.size);
      server.sizeMb = (server.size / 1024 / 1024).toFixed(2);
    }

    return servers;
  }

  private async getCharacterSavedVariables(
    installation: WowInstallation,
    account: string,
    server: string,
    character: string,
    addonFolders: AddonFolder[]
  ): Promise<SavedVariable[]> {
    const savedVars = await this._wtfService.getCharacterVariables(installation, account, server, character);

    const vars: SavedVariable[] = savedVars.map((gv) => {
      return {
        hasAddon: addonFolders.some((af) => af.name === removeExtension(gv.name)),
        name: gv.name,
        size: gv.stats.size,
      };
    });

    return vars;
  }
}
