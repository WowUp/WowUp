export const AppConfig = {
  production: false,
  environment: "LOCAL",
  wowUpWebsiteUrl: "https://dev.wowup.io",
  wowUpApiUrl: "https://api.dev.wowup.io",
  wowUpHubUrl: "https://hub.dev.wowup.io",
  wowupRepositoryUrl: "https://github.com/WowUp/WowUp",
  warcraftTavernNewsFeedUrl:
    "https://www.warcrafttavern.com/?call_custom_simple_rss=1&csrp_post_type=wow-classic-news,tbc-classic-news,retail-news&csrp_thumbnail_size=medium",
  azure: {
    applicationInsightsKey: "4a53e8d9-796c-4f80-b1a6-9a058374dd6d",
  },
  wago: {
    enabled: false,
    termsUrl: "https://addons.wago.io/agreements/terms-of-service",
    dataConsentUrl: "https://addons.wago.io/agreements/wowup-data-consent",
  },
  curseforge: {
    enabled: false,
    httpTimeoutMs: 60000,
    apiKey: "{{CURSEFORGE_API_KEY}}",
  },
  autoUpdateIntervalMs: 3600000, // 1 hour
  appUpdateIntervalMs: 3600000, // 1 hour
  defaultHttpTimeoutMs: 10000,
  defaultHttpResetTimeoutMs: 30000,
  wowUpHubHttpTimeoutMs: 10000,
  wagoHttpTimeoutMs: 10000,
  newsRefreshIntervalMs: 3600000, // 1 hour
  featuredAddonsCacheTimeSec: 30, // 30 sec
};
