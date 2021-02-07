export const AppConfig = {
  production: true,
  environment: "PROD",
  wowUpApiUrl: "https://api.wowup.io",
  wowUpHubUrl: "https://hub.wowup.io",
  googleAnalyticsId: "UA-92563227-4",
  wowupRepositoryUrl: "https://github.com/WowUp/WowUp",
  azure: {
    applicationInsightsKey: "4a53e8d9-796c-4f80-b1a6-9a058374dd6d",
  },
  autoUpdateIntervalMs: 3600000, // 1 hour
  appUpdateIntervalMs: 3600000, // 1 hour
  defaultHttpTimeoutMs: 10000,
  defaultHttpResetTimeoutMs: 30000,
  wowUpHubHttpTimeoutMs: 10000,
};
