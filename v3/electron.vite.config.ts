import { resolve, join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

console.debug('electron.vite.config.ts', 'BUILD_FLAVOR', process.env.BUILD_FLAVOR)

process.env.MAIN_VITE_BUILD_FLAVOR = 'wago'
process.env.RENDERER_VITE_BUILD_FLAVOR = 'wago'
process.env.PRELOAD_VITE_BUILD_FLAVOR = 'wago'

if (process.env.BUILD_FLAVOR === 'ow') {
  const owElectronPath = join(
    __dirname,
    'node_modules',
    '@overwolf',
    'ow-electron',
    'dist',
    'electron.exe'
  )
  console.log('ow', owElectronPath)
  process.env.ELECTRON_EXEC_PATH = owElectronPath
  process.env.MAIN_VITE_BUILD_FLAVOR = 'ow'
  process.env.RENDERER_VITE_BUILD_FLAVOR = 'ow'
  process.env.PRELOAD_VITE_BUILD_FLAVOR = 'ow'
}

const packagePath = join(__dirname, 'package.json')
const packageData = readFileSync(packagePath, 'utf8')
const packageJson = JSON.parse(packageData)

packageJson.name = process.env.BUILD_FLAVOR === 'ow' ? 'wowup-cf' : 'wowup'
packageJson.productName = process.env.BUILD_FLAVOR === 'ow' ? 'WowUpCf' : 'WowUp'

writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

// ELECTRON_EXEC_PATH

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'es'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
