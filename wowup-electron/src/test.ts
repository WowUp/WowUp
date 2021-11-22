// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import "zone.js/testing";
import { getTestBed } from "@angular/core/testing";
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from "@angular/platform-browser-dynamic/testing";

declare const require: any;

jasmine.getEnv().addReporter({
  suiteStarted: function (result) {
    console.log(`suiteStarted: ${result.fullName}`);
  },
  specStarted: function () {
    // console.log(`specStarted: ${result.fullName}`);
  },
  specDone: function (result) {
    console.log(`specDone: ${result.fullName}`);
  },
  jasmineDone: (result) => {
    console.log(`Jasmine done`);
    console.log(JSON.stringify(result, null, 2));
  },
});

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: false },
});
// Then we find all the tests.
const context = require.context("./", true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
