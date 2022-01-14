const gulp = require("gulp");
const del = require("del");
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

const prePackageTasks = [
  npmRun("lint"),
  npmRun("build:prod"),
  prePackageTask,
  prePackageCopyTask,
  packageChDir,
  npmRun("install:prod"),
];

exports.default = defaultTask;
exports.package = gulp.series(...prePackageTasks, npmRun("electron:publish"));
exports.packageLocal = gulp.series(...prePackageTasks, npmRun("electron:publish:never:local"));
