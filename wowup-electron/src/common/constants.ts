export const ADDON_PROVIDER_WOWINTERFACE = "WowInterface";
export const ADDON_PROVIDER_CURSEFORGE = "Curse";
export const ADDON_PROVIDER_GITHUB = "GitHub";
export const ADDON_PROVIDER_RAIDERIO = "RaiderIO";
export const ADDON_PROVIDER_TUKUI = "TukUI";
export const ADDON_PROVIDER_UNKNOWN = "Unknown";
export const ADDON_PROVIDER_HUB = "Hub";

// IPC CHANNELS
export const DOWNLOAD_FILE_CHANNEL = "download-file";
export const COPY_DIRECTORY_CHANNEL = "copy-directory";
export const CREATE_DIRECTORY_CHANNEL = "create-directory";
export const DELETE_DIRECTORY_CHANNEL = "delete-directory";
export const STAT_DIRECTORY_CHANNEL = "stat-directory";
export const LIST_DIRECTORIES_CHANNEL = "list-directories";
export const STAT_FILES_CHANNEL = "stat_files";
export const PATH_EXISTS_CHANNEL = "path-exists";
export const LIST_FILES_CHANNEL = "list-files";
export const READ_FILE_CHANNEL = "read-file";
export const WRITE_FILE_CHANNEL = "write-file";
export const UNZIP_FILE_CHANNEL = "unzip-file";
export const COPY_FILE_CHANNEL = "copy-file";
export const CURSE_HASH_FILE_CHANNEL = "curse-hash-file";
export const SHOW_DIRECTORY = "show-directory";
export const CURSE_GET_SCAN_RESULTS = "curse-get-scan-results";
export const WOWUP_GET_SCAN_RESULTS = "wowup-get-scan-results";
export const GET_ASSET_FILE_PATH = "get-asset-file-path";
export const CREATE_TRAY_MENU_CHANNEL = "create-tray-menu";
export const LIST_DISKS_WIN32 = "list-disks-win32";
export const CREATE_APP_MENU_CHANNEL = "create-app-menu";
export const MENU_ZOOM_OUT_CHANNEL = "menu-zoom-out";
export const MENU_ZOOM_IN_CHANNEL = "menu-zoom-in";
export const MENU_ZOOM_RESET_CHANNEL = "menu-zoom-reset";
export const MAXIMIZE_WINDOW = "maximize-window";
export const MINIMIZE_WINDOW = "minimize-window";
export const WINDOW_MAXIMIZED = "window-maximized";
export const WINDOW_UNMAXIMIZED = "window-unmaximized";
export const WINDOW_MINIMIZED = "window-minimized";

// PREFERENCES
export const ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY = "enable_system_notifications";
export const COLLAPSE_TO_TRAY_PREFERENCE_KEY = "collapse_to_tray";
export const WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY = "wowup_release_channel";
export const DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX = "_default_addon_channel";
export const DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX = "_default_auto_update";
export const LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY = "last_selected_client_type";
export const USE_HARDWARE_ACCELERATION_PREFERENCE_KEY = "use_hardware_acceleration";
export const START_WITH_SYSTEM_PREFERENCE_KEY = "start_with_system";
export const START_MINIMIZED_PREFERENCE_KEY = "start_minimized";
export const SELECTED_LANGUAGE_PREFERENCE_KEY = "selected_language";
export const MY_ADDONS_HIDDEN_COLUMNS_KEY = "my_addons_hidden_columns";
export const MY_ADDONS_SORT_ORDER = "my_addons_sort_order";
export const GET_ADDONS_HIDDEN_COLUMNS_KEY = "get_addons_hidden_columns";
export const GET_ADDONS_SORT_ORDER = "get_addons_sort_order";
export const ADDON_PROVIDERS_KEY = "addon_providers";
export const CURRENT_THEME_KEY = "current_theme";
export const TELEMETRY_ENABLED_KEY = "telemetry_enabled";
export const BLIZZARD_AGENT_PATH_KEY = "blizzard_agent_path";
export const ZOOM_FACTOR_KEY = "zoom_factor";
export const SELECTED_DETAILS_TAB_KEY = "selected_details_tab";

// APP UPDATER
export const APP_UPDATE_ERROR = "app-update-error";
export const APP_UPDATE_DOWNLOADED = "app-update-downloaded";
export const APP_UPDATE_NOT_AVAILABLE = "app-update-not-available";
export const APP_UPDATE_AVAILABLE = "app-update-available";
export const APP_UPDATE_START_DOWNLOAD = "app-update-start-download";
export const APP_UPDATE_INSTALL = "app-update-install";
export const APP_UPDATE_CHECK_FOR_UPDATE = "app-update-check-for-update";
export const APP_UPDATE_CHECK_START = "app-update-check-start";
export const APP_UPDATE_CHECK_END = "app-update-check-end";

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
