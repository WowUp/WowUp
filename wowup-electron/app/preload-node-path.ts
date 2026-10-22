import Module = require("module");

// The preload requires its externals (electron-log, win-ca) from the shell's node_modules, which the shell
// puts on NODE_PATH (see useShellNodeModules in wowup-shell/src/bootstrap.ts). The renderer inherits
// NODE_PATH, but Electron's renderer startup clears Node's global search paths, so they're recomputed here.
// preload.ts imports this first, before anything external loads.
(Module as unknown as { _initPaths: () => void })._initPaths();
