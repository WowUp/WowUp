export const APP_USER_MODEL_ID = "io.wowup.jliddev"; // Bundle ID

export const ADDON_PROVIDER_WOWINTERFACE = "WowInterface";
export const ADDON_PROVIDER_CURSEFORGE = "Curse";
export const ADDON_PROVIDER_GITHUB = "GitHub";
export const ADDON_PROVIDER_RAIDERIO = "RaiderIO";
export const ADDON_PROVIDER_TUKUI = "TukUI";
export const ADDON_PROVIDER_UNKNOWN = "Unknown";
export const ADDON_PROVIDER_HUB_LEGACY = "Hub";
export const ADDON_PROVIDER_HUB = "WowUpHub";
export const ADDON_PROVIDER_WOWUP_COMPANION = "WowUpCompanion";
export const ADDON_PROVIDER_ZIP = "Zip";

export const APP_PROTOCOL_NAME = "wowup";
export const CURSE_PROTOCOL_NAME = "curseforge";

// WOWUP ADDON
export const WOWUP_ADDON_FOLDER_NAME = "WowUp";
export const WOWUP_DATA_ADDON_FOLDER_NAME = "wowup_data_addon";
export const WOWUP_ASSET_FOLDER_NAME = "WowUpAddon";

// IPC CHANNELS
export const IPC_DOWNLOAD_FILE_CHANNEL = "download-file";
export const IPC_COPY_DIRECTORY_CHANNEL = "copy-directory";
export const IPC_CREATE_DIRECTORY_CHANNEL = "create-directory";
export const IPC_DELETE_DIRECTORY_CHANNEL = "delete-directory";
export const IPC_STAT_DIRECTORY_CHANNEL = "stat-directory";
export const IPC_LIST_DIRECTORIES_CHANNEL = "list-directories";
export const IPC_STAT_FILES_CHANNEL = "stat-files";
export const IPC_PATH_EXISTS_CHANNEL = "path-exists";
export const IPC_LIST_FILES_CHANNEL = "list-files";
export const IPC_READ_FILE_CHANNEL = "read-file";
export const IPC_READ_FILE_BUFFER_CHANNEL = "read-file-buffer";
export const IPC_WRITE_FILE_CHANNEL = "write-file";
export const IPC_UNZIP_FILE_CHANNEL = "unzip-file";
export const IPC_COPY_FILE_CHANNEL = "copy-file";
export const IPC_CURSE_HASH_FILE_CHANNEL = "curse-hash-file";
export const IPC_SHOW_DIRECTORY = "show-directory";
export const IPC_CURSE_GET_SCAN_RESULTS = "curse-get-scan-results";
export const IPC_WOWUP_GET_SCAN_RESULTS = "wowup-get-scan-results";
export const IPC_GET_ASSET_FILE_PATH = "get-asset-file-path";
export const IPC_CREATE_TRAY_MENU_CHANNEL = "create-tray-menu";
export const IPC_LIST_DISKS_WIN32 = "list-disks-win32";
export const IPC_CREATE_APP_MENU_CHANNEL = "create-app-menu";
export const IPC_MENU_ZOOM_OUT_CHANNEL = "menu-zoom-out";
export const IPC_MENU_ZOOM_IN_CHANNEL = "menu-zoom-in";
export const IPC_MENU_ZOOM_RESET_CHANNEL = "menu-zoom-reset";
export const IPC_MAXIMIZE_WINDOW = "maximize-window";
export const IPC_MINIMIZE_WINDOW = "minimize-window";
export const IPC_FOCUS_WINDOW = "focus-window";
export const IPC_WINDOW_MAXIMIZED = "window-maximized";
export const IPC_WINDOW_UNMAXIMIZED = "window-unmaximized";
export const IPC_WINDOW_MINIMIZED = "window-minimized";
export const IPC_WINDOW_ENTER_FULLSCREEN = "enter-full-screen";
export const IPC_WINDOW_LEAVE_FULLSCREEN = "leave-full-screen";
export const IPC_CLOSE_WINDOW = "close-window";
export const IPC_RESTART_APP = "restart-app";
export const IPC_QUIT_APP = "quit-app";
export const IPC_POWER_MONITOR_RESUME = "power-monitor-resume";
export const IPC_POWER_MONITOR_SUSPEND = "power-monitor-suspend";
export const IPC_POWER_MONITOR_LOCK = "power-monitor-lock";
export const IPC_POWER_MONITOR_UNLOCK = "power-monitor-unlock";
export const IPC_GET_ZOOM_FACTOR = "get-zoom-factor";
export const IPC_SET_ZOOM_LIMITS = "set-zoom-limits";
export const IPC_SET_ZOOM_FACTOR = "set-zoom-factor";
export const IPC_GET_APP_VERSION = "get-app-version";
export const IPC_GET_LOCALE = "get-locale";
export const IPC_GET_LAUNCH_ARGS = "get-launch-args";
export const IPC_GET_LOGIN_ITEM_SETTINGS = "get-login-item-settings";
export const IPC_SET_LOGIN_ITEM_SETTINGS = "set-login-item-settings";
export const IPC_LIST_ENTRIES = "list-entries";
export const IPC_READDIR = "readdir";
export const IPC_IS_DEFAULT_PROTOCOL_CLIENT = "is-default-protocol-client";
export const IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT = "set-as-default-protocol-client";
export const IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT = "remove-as-default-protocol-client";
export const IPC_REQUEST_INSTALL_FROM_URL = "request-install-from-url";
export const IPC_CUSTOM_PROTOCOL_RECEIVED = "custom-protocol-received";
export const IPC_ADDONS_SAVE_ALL = "addons-save-all";
export const IPC_GET_PENDING_OPEN_URLS = "get-pending-open-urls";
export const IPC_GET_LATEST_DIR_UPDATE_TIME = "get-latest-dir-update-time";
export const IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT = "system-preferences-get-user-default";
export const IPC_SHOW_OPEN_DIALOG = "show-open-dialog";
export const IPC_APP_UPDATE_STATE = "app-update-state";
export const IPC_APP_INSTALL_UPDATE = "app-install-update";
export const IPC_APP_CHECK_UPDATE = "app-check-update";
export const IPC_UPDATE_APP_BADGE = "update-app-badge";
export const IPC_WINDOW_RESUME = "window-resume";

// IPC STORAGE
export const IPC_STORE_GET_OBJECT = "store-get-object";
export const IPC_STORE_SET_OBJECT = "store-set-object";

// STORES
export const ADDON_STORE_NAME = "addons";
export const PREFERENCE_STORE_NAME = "preferences";

// PREFERENCES
export const ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY = "enable_system_notifications";
export const COLLAPSE_TO_TRAY_PREFERENCE_KEY = "collapse_to_tray";
export const WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY = "wowup_release_channel";
export const DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX = "_default_addon_channel";
export const DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX = "_default_auto_update";
export const LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY = "last_selected_client_type";
export const USE_HARDWARE_ACCELERATION_PREFERENCE_KEY = "use_hardware_acceleration";
export const USE_SYMLINK_MODE_PREFERENCE_KEY = "use_symlink_mode";
export const START_WITH_SYSTEM_PREFERENCE_KEY = "start_with_system";
export const START_MINIMIZED_PREFERENCE_KEY = "start_minimized";
export const SELECTED_LANGUAGE_PREFERENCE_KEY = "selected_language";
export const MY_ADDONS_HIDDEN_COLUMNS_KEY = "my_addons_hidden_columns";
export const MY_ADDONS_SORT_ORDER = "my_addons_sort_order";
export const GET_ADDONS_HIDDEN_COLUMNS_KEY = "get_addons_hidden_columns";
export const GET_ADDONS_SORT_ORDER = "get_addons_sort_order";
export const ADDON_PROVIDERS_KEY = "addon_providers";
export const WOW_INSTALLATIONS_KEY = "wow_installations";
export const CURRENT_THEME_KEY = "current_theme";
export const TELEMETRY_ENABLED_KEY = "telemetry_enabled";
export const BLIZZARD_AGENT_PATH_KEY = "blizzard_agent_path";
export const ZOOM_FACTOR_KEY = "zoom_factor";
export const SELECTED_DETAILS_TAB_KEY = "selected_details_tab";
export const ADDON_MIGRATION_VERSION_KEY = "addon_migration_version";
export const UPDATE_NOTES_POPUP_VERSION_KEY = "update_notes_popup_version";
export const ENABLE_APP_BADGE_KEY = "enable_app_badge";
export const TRUSTED_DOMAINS_KEY = "trusted_domains";

// THEMES
export const DEFAULT_THEME = "default-theme";
export const DEFAULT_LIGHT_THEME = "default-theme-light-theme";
export const HORDE_THEME = "horde-theme";
export const HORDE_LIGHT_THEME = "horde-theme-light-theme";
export const ALLIANCE_THEME = "alliance-theme";
export const ALLIANCE_LIGHT_THEME = "alliance-theme-light-theme";
export const DEFAULT_BG_COLOR = "#444444";
export const DEFAULT_LIGHT_BG_COLOR = "#ebedef";

// ERRORS
export const ERROR_ADDON_ALREADY_INSTALLED = "error-addon-already-installed";
export const NO_SEARCH_RESULTS_ERROR = "no-search-results";
export const NO_LATEST_SEARCH_RESULT_FILES_ERROR = "no-latest-search-result-files";

// VALUES
export const WINDOW_DEFAULT_WIDTH = 1280;
export const WINDOW_DEFAULT_HEIGHT = 720;
export const WINDOW_MIN_WIDTH = 940;
export const WINDOW_MIN_HEIGHT = 500;
export const MIN_VISIBLE_ON_SCREEN = 32;
export const WOWUP_LOGO_FILENAME = "wowup_logo_purple.png";
export const WOWUP_LOGO_MAC_SYSTEM_TRAY = "wowupBlackLgNopadTemplate.png";

<<<<<<< HEAD
export const WOW_CLASSIC_FOLDER = "_classic_";
export const WOW_CLASSIC_ERA_FOLDER = "_classic_era_";
export const WOW_RETAIL_FOLDER = "_retail_";
export const WOW_RETAIL_PTR_FOLDER = "_ptr_";
export const WOW_CLASSIC_PTR_FOLDER = "_classic_ptr_";
export const WOW_BETA_FOLDER = "_beta_";
export const WOW_CLASSIC_BETA_FOLDER = "_classic_beta_";

export const TAB_INDEX_MY_ADDONS = 0;
export const TAB_INDEX_GET_ADDONS = 1;
export const TAB_INDEX_ABOUT = 2;
export const TAB_INDEX_NEWS = 3;
export const TAB_INDEX_SETTINGS = 4;

export const USER_ACTION_BROWSE_CATEGORY = "browse-category";
export const USER_ACTION_OPEN_LINK = "open-link";
export const USER_ACTION_ADDON_SEARCH = "addon-search";
export const USER_ACTION_ADDON_PROTOCOL_SEARCH = "addon-protocol-search";
export const USER_ACTION_ADDON_INSTALL = "addon-install-action";
=======
//BACKUP
export const ENABLED_BACKUP = "enabled_backup";
export const ENABLED_AUTOMATIC_BACKUP = "enabled_automatic_backup";
export const LAST_BACKUP_DATE = "last_backup_date";
>>>>>>> (feat) backup/restore user interface
