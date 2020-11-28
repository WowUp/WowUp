// Inspired by https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db
const fs = require('fs');
const path = require('path');
const electron_notarize = require('electron-notarize');

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
  const appId = 'io.wowup.jliddev'
  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  console.log(`Notarizing ${appId} found at ${appPath}`);

  try {
    await electron_notarize.notarize({
      appBundleId: appId,
      appPath: appPath,
      appleId: process.env.NOTARIZE_APPLE_ID,
      appleIdPassword: process.env.NOTARIZE_APPLE_PASSWORD,
      ascProvider: process.env.NOTARIZE_APPLE_TEAM_ID
    });
  } catch (error) {
    console.error(error);
  }

  console.log(`Done notarizing ${appId}`);
};