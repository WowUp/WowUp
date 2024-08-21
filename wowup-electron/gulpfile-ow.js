require("dotenv").config();

const gulp = require("gulp");
const del = require("del");
const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

function defaultTask(cb) {
  // place code for your default task here
  cb();
}

function prePackageTask(cb) {
  return del("package_workspace/**", { force: true });
}

function prePackageCopyTask(cb) {
  return gulp
    .src(["./**/*.*", "!node_modules/**/*.*", "!package_workspace/**/*.*", "!release/**/*.*"], { base: "./" })
    .pipe(gulp.dest("package_workspace/"));
}

function packageChDir(cb) {
  process.chdir("./package_workspace");
  cb();
}

function npmRunTask(cb, buildJob) {
  console.log("packageTask", buildJob);

  const ls = spawn("npm", ["run", buildJob], {
    shell: true,
  });

  ls.stdout.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });

  ls.stderr.on("data", (data) => {
    console.log(`stderr: ${data}`);
  });

  ls.on("error", (error) => {
    console.log(`error: ${error.message}`);
  });

  ls.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
    cb();
  });
}

function npmRun(cmd) {
  return function npmRunCmd(cb) {
    npmRunTask(cb, cmd);
  };
}

async function updateCfKey() {
  const cfApiKey = process.env.CURSEFORGE_API_KEY;
  console.log(cfApiKey);
  if (typeof cfApiKey !== "string" || cfApiKey.length === 0) {
    throw new Error("CURSEFORGE_API_KEY missing");
  }

  const envPath = "src/environments";
  const environments = await fs.readdir(envPath);

  for (let env of environments) {
    const filePath = path.join(envPath, env);
    let envData = await fs.readFile(filePath, { encoding: "utf-8" });
    envData = envData.replace("{{CURSEFORGE_API_KEY}}", cfApiKey);

    await fs.writeFile(filePath, envData);
    console.log(envData);
  }
}

const prePackageTasks = [
  npmRun("lint"),
  npmRun("build:prod"),
  prePackageTask,
  prePackageCopyTask,
  packageChDir,
  npmRun("install:prod"),
];

exports.default = defaultTask;
exports.packageCfLocal = gulp.series(updateCfKey, npmRun("electron:publish:never:local"));
