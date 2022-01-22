const fs = require("fs");
const path = require("path");
const ignore = require("ignore");
const { execSync, spawn } = require("child_process");

const gitIgnoreFile = fs.readFileSync(".gitignore", { encoding: "utf-8" });
const gitIgnore = gitIgnoreFile.split("\n");

const ig = ignore().add(gitIgnore);

const shouldClear = process.argv.indexOf("--clear") !== -1;
const shouldRepair = process.argv.indexOf("--repair") !== -1;
const shouldStep = process.argv.indexOf("--step") !== -1;
const shouldFindBreak = process.argv.indexOf("--find-break") !== -1;

const getAllFiles = function (dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    const filePath = path.join(dirPath, file);

    if (ig.ignores(filePath)) {
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(__dirname, dirPath, "/", file));
    }
  });

  return arrayOfFiles;
};

function repairPath(ogPath) {
  const newPath = ogPath.slice(0, -1);
  fs.renameSync(ogPath, newPath);
  console.log(`${ogPath} -> ${newPath}`);
}

function executeTests() {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Running ${countTests()} tests`);
      const ls = spawn("ng.cmd", ["test", "--watch=false"], {
        cwd: __dirname,
      });

      let output = [];
      ls.stdout.on("data", (data) => {
        // console.log(`stdout: ${data}`);
        if (typeof data === "string") {
          output.push(data);
        }
      });

      ls.stderr.on("data", (data) => {
        // console.error(`stderr: ${data}`);
        if (typeof data === "string") {
          output.push(data);
        }
      });

      ls.on("close", (code) => {
        if (code !== 0) {
          console.log(output.join("\n"));
        }
        console.log(`child process exited with code ${code}`);
        resolve(code);
      });
    } catch (error) {
      error.status; // Might be 127 in your example.
      error.message; // Holds the message you typically want.
      error.stderr; // Holds the stderr output. Use `.toString()`.
      error.stdout; // Holds the stdout output. Use `.toString()`.
      console.error(error.message || error);
    }
  });
}

function getTests() {
  const allFiles = getAllFiles(".", []);
  return allFiles.filter((f) => f.endsWith(".spec.ts"));
}

function getTestOverrides() {
  const allFiles = getAllFiles(".", []);
  return allFiles.filter((f) => f.endsWith(".spec.tsw"));
}

function countTestsOverrides() {
  return getTestOverrides().length;
}

function countTests() {
  return getTests().length;
}

function runClear() {
  console.log(`Running Clear`);
  const allFiles = getAllFiles(".", []);
  const testFiles = allFiles.filter((f) => f.endsWith(".spec.ts"));

  testFiles.forEach((f) => {
    const newPath = f + "w";
    fs.renameSync(f, newPath);
    console.log(`${f} -> ${newPath}`);
  });
}

function runRepair() {
  console.log(`Running Repair`);
  const allFiles = getAllFiles(".", []);
  const testFiles = allFiles.filter((f) => f.endsWith(".spec.tsw"));

  testFiles.forEach((f) => {
    repairPath(f);
  });
}

function runStep() {
  console.log(`Running Next`);
  const allFiles = getAllFiles(".", []);
  const testFiles = allFiles.filter((f) => f.endsWith(".spec.tsw"));

  const firstFile = testFiles[0];

  repairPath(firstFile);
}

async function runFindBreak() {
  console.log(`Running Find Break`);
  runClear();

  while (countTestsOverrides() > 0) {
    runStep();
    const code = await executeTests();
    if (code !== 0) {
      throw new Error("executeTests failed");
    }
  }
}

if (shouldClear) {
  runClear();
}

if (shouldRepair) {
  runRepair();
}

if (shouldStep) {
  runStep();
}

if (shouldFindBreak) {
  runFindBreak().catch((e) => {
    const allTests = getTests();
    const lastTestFile = allTests[allTests.length - 1];
    const relativePath = lastTestFile.substr(lastTestFile.indexOf("src\\") + 4);
    console.error(`Failed test found: ${lastTestFile}`);
    console.error(`ng test --watch=false --include='${relativePath}'`);
    console.error(e);
  });
}
