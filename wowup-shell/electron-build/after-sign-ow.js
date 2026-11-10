// Inspired by https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db
const fs = require('fs');
const path = require('path');
const electron_notarize = require('@electron/notarize');

// Pull in signing env vars
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})

module.exports = async function (params) {
  // Only notarize the app on Mac OS only.
  if (process.platform !== 'darwin') {
    return;
  }
  console.log('afterSign hook triggered');

  // Same appId in electron-builder.
  const appId = 'io.wowupcf.jliddev'
  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  console.log(`Notarizing ${appId} found at ${appPath}`);

  const missing = ['NOTARIZE_APPLE_ID', 'NOTARIZE_APPLE_PASSWORD', 'NOTARIZE_APPLE_TEAM_ID'].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    // A CI build must never ship un-notarized; local builds may skip it.
    if (process.env.CI) {
      throw new Error(`Cannot notarize ${appId}, missing env vars: ${missing.join(', ')}`);
    }
    console.warn(`Skipping notarization of ${appId}, missing env vars: ${missing.join(', ')}`);
    return;
  }

  // Let notarize errors (e.g. HTTP 403 for an expired Apple agreement) propagate so
  // electron-builder fails the build instead of uploading un-notarized artifacts.
  await electron_notarize.notarize({
    appBundleId: appId,
    appPath: appPath,
    appleId: process.env.NOTARIZE_APPLE_ID,
    appleIdPassword: process.env.NOTARIZE_APPLE_PASSWORD,
    teamId: process.env.NOTARIZE_APPLE_TEAM_ID,
    ascProvider: process.env.NOTARIZE_APPLE_TEAM_ID
  });

  console.log(`Done notarizing ${appId}`);
};
