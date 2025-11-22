// this script adapted from
// https://github.com/electron-userland/electron-builder/issues/6158#issuecomment-899798533
const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");

const packagePath = path.join(__dirname, "..", "package.json");
const packageData = fs.readFileSync(packagePath, "utf8");
const packageJson = JSON.parse(packageData);
const isNonProd = packageJson.version.includes("beta") || packageJson.version.includes("dev");

const TEMP_DIR = path.join(__dirname, "..", "release", "temp");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const WORKING_DIR = path.join(__dirname, "..", "release", "temp-signed");
if (!fs.existsSync(WORKING_DIR)) {
  fs.mkdirSync(WORKING_DIR, { recursive: true });
}

function setNonProdConfig() {
  const configDir = path.join(__dirname, "code_signer", "conf", "code_sign_tool.properties");
  console.log("Setting NON-PROD code signing config", configDir);

  const config = `
CLIENT_ID=qOUeZCCzSqgA93acB3LYq6lBNjgZdiOxQc-KayC3UMw
OAUTH2_ENDPOINT=https://oauth-sandbox.ssl.com/oauth2/token
CSC_API_ENDPOINT=https://cs-try.ssl.com
TSA_URL=http://ts.ssl.com
`;

  fs.writeFileSync(configDir, config);
}

console.log(`SIGNING FOR WINDOWS ${isNonProd ? "NON-PROD" : "PROD"} BUILD`);
function sign(configuration) {
  if (isNonProd) {
    setNonProdConfig();
  }

  const credentialId = isNonProd
    ? process.env.WINDOWS_SIGN_CREDENTIAL_ID_NONPROD
    : process.env.WINDOWS_SIGN_CREDENTIAL_ID_PROD;

  const username = process.env.WINDOWS_SIGN_USER_NAME;
  const password = process.env.WINDOWS_SIGN_USER_PASSWORD;
  const totpSecret = isNonProd ? process.env.WINDOWS_SIGN_USER_TOTP_NONPROD : process.env.WINDOWS_SIGN_USER_TOTP_PROD;

  console.debug(`Signing file ${configuration.path}`);
  console.debug(`Using credential ID: ${credentialId} (${credentialId.length})`);
  console.debug(`Using username: ${username} (${username.length})`);
  console.debug(`Using password ${password} (${password.length})`);
  console.debug(`Using TOTP secret: ${totpSecret} (${totpSecret.length})`);

  // we move signed files to a file named tmp.exe because our product name
  // contains a space, meaning our .exe contains a space, which CodeSignTool
  // balks at even with attempted backslash escaping, so we rename to tmp.exe
  const tmpExe = `tmp-${Math.random()}.exe`;
  const tmpExePath = path.join(TEMP_DIR, tmpExe);

  const codeSignerDir = path.join(__dirname, "code_signer");
  const codeSignerPath = path.join(__dirname, "code_signer", "CodeSignTool.bat");

  // note: CodeSignTool can't sign in place without verifying the overwrite
  // with a y/m interaction so we are creating a new file in a temp directory
  // and then replacing the original file with the signed file.
  const signFile = [
    `cmd /c ${codeSignerPath} sign`,
    `-input_file_path="${tmpExePath}"`,
    `-output_dir_path="${WORKING_DIR}"`,
    `-credential_id="${credentialId}"`,
    `-username="${username}"`,
    `-password="${password}"`,
    `-totp_secret="${totpSecret}"`,
  ].join(" ");
  const preMoveFile = `copy "${configuration.path}" "${tmpExePath}"`;
  const postMoveFile = `copy "${path.join(WORKING_DIR, tmpExe)}" "${configuration.path}"`;
  console.debug(`Copying file from ${configuration.path} to ${tmpExePath}`);
  childProcess.execSync(preMoveFile, {
    stdio: "inherit",
  });

  console.debug(`Signing file ${tmpExePath}`);
  childProcess.execSync(signFile, {
    stdio: "inherit",
    env: Object.assign({}, process.env, {
      CODE_SIGN_TOOL_PATH: codeSignerDir,
    }),
  });

  console.debug(`Moving signed file from ${path.join(WORKING_DIR, tmpExe)} to ${configuration.path}`);
  childProcess.execSync(postMoveFile, {
    stdio: "inherit",
  });
}

exports.default = sign;
