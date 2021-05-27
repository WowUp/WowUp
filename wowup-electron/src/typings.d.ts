/* SystemJS module definition */
declare let nodeModule: NodeModule;
interface NodeModule {
  id: string;
}
interface Window {
  process: any;
  require: any;
}

declare type DetailsTabType = "description" | "changelog" | "last_used_tab";
declare type AddonIgnoreReason = "git_repo" | "missing_dependency" | "unknown";
