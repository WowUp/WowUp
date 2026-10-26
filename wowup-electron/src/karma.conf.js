// Karma configuration file, see link for more information
// https://karma-runner.github.io/0.13/config/configuration-file.html

// Without a terminal (CI, agents), "progress" prints a line per spec and specs' console.log calls are
// relayed, which adds up to megabytes of output; "dots" and no console capture keep it to the failures.
const interactive = Boolean(process.stdout.isTTY); // undefined would be skipped by config.set's merge

module.exports = function (config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine", "@angular-devkit/build-angular"],
    plugins: [
      require("karma-jasmine"),
      require("karma-electron"),
      require("karma-jasmine-html-reporter"),
      require("karma-coverage-istanbul-reporter"),
      require("@angular-devkit/build-angular/plugins/karma"),
    ],
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
      captureConsole: interactive,
    },
    coverageIstanbulReporter: {
      dir: require("path").join(__dirname, "../coverage"),
      reports: ["html", "lcovonly"],
      fixWebpackSourcePaths: true,
    },
    reporters: interactive ? ["progress", "kjhtml"] : ["dots"],
    browserConsoleLogOptions: { terminal: interactive },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ["AngularElectron"],
    customLaunchers: {
      AngularElectron: {
        base: "Electron",
        flags: ["--remote-debugging-port=9222"],
        browserWindowOptions: {
          webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInSubFrames: true,
            allowRunningInsecureContent: true,
            contextIsolation: false,
          },
        },
      },
    },
  });
};
