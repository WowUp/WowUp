import fsp from 'fs/promises'
import { join } from 'path'
import * as _ from 'lodash'
import { Dirent, Stats } from 'fs'
import * as crypto from 'crypto'

interface SymlinkDir {
  original: Dirent
  originalPath: string
  realPath: string
  isDir: boolean
}

interface StatFilesResult {
  [path: string]: Stats
}

export const readFile = async (filePath: string): Promise<string> => {
  return fsp.readFile(filePath, 'utf-8')
}

export const pathExists = async (filePath: string): Promise<boolean> => {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return false
  }

  try {
    await fsp.access(filePath)
    return true
  } catch (err) {
    console.error(err)
  }

  return false
}

export async function readDirRecursive(sourcePath: string): Promise<string[]> {
  let hardPath = sourcePath

  const sourceStats = await fsp.lstat(sourcePath)
  if (sourceStats.isSymbolicLink()) {
    hardPath = await fsp.readlink(sourcePath)
  }

  const dirFiles: string[] = []
  const files = await fsp.readdir(hardPath, { withFileTypes: true })

  for (const file of files) {
    const filePath = join(hardPath, file.name)
    if (file.isDirectory()) {
      const nestedFiles = await readDirRecursive(filePath)
      dirFiles.push(...nestedFiles)
    } else {
      dirFiles.push(filePath)
    }
  }

  return dirFiles
}

export async function statFiles(filePaths: string[]): Promise<StatFilesResult> {
  const results: StatFilesResult = {}

  // TODO batch max parallel this like before
  for (const filePath of filePaths) {
    try {
      const statRes = await fsp.stat(filePath)
      results[filePath] = statRes
    } catch (err) {
      console.error(err)
    }
  }

  return results
}

export async function getDirectories(filePath: string, scanSymlinks: boolean): Promise<string[]> {
  const files = await fsp.readdir(filePath, { withFileTypes: true })
  let symlinkNames: string[] = []
  if (scanSymlinks === true) {
    console.info('Scanning symlinks')
    const symlinkDirs = await getSymlinkDirs(filePath, files)
    symlinkNames = _.map(symlinkDirs, (symLink) => symLink.original.name)
  }

  const directories = files.filter((file) => file.isDirectory()).map((file) => file.name)
  return [...directories, ...symlinkNames]
}

export function hashString(str: string | crypto.BinaryLike, alg = 'md5'): string {
  const md5 = crypto.createHash(alg)
  md5.update(str)
  return md5.digest('hex')
}

export async function hashFile(filePath: string, alg = 'md5'): Promise<string> {
  try {
    const text = await fsp.readFile(filePath)
    return hashString(text, alg)
  } catch (e) {
    console.error(`hashFile failed: ${filePath}`)
    console.error(e)
    throw e
  }
}

async function getSymlinkDirs(basePath: string, files: Dirent[]): Promise<SymlinkDir[]> {
  // Find and resolve symlinks found and return the folder names as
  const symlinks = _.filter(files, (file) => file.isSymbolicLink())
  const symlinkDirs: SymlinkDir[] = _.map(symlinks, (sym) => {
    return {
      original: sym,
      originalPath: join(basePath, sym.name),
      realPath: '',
      isDir: false
    }
  })

  for (const symlinkDir of symlinkDirs) {
    const realPath = await fsp.realpath(symlinkDir.originalPath)
    const lstatRes = await fsp.lstat(realPath)

    symlinkDir.realPath = realPath
    symlinkDir.isDir = lstatRes.isDirectory()
  }

  return _.filter(symlinkDirs, (symDir) => symDir.isDir)
}
