const fs = require('fs').promises
const path = require('path')

async function deleteFolderRecursive(folderPath) {
  try {
    const files = await fs.readdir(folderPath)
    for (const file of files) {
      const currentPath = path.join(folderPath, file)
      const stat = await fs.lstat(currentPath)
      if (stat.isDirectory()) {
        await deleteFolderRecursive(currentPath)
      } else {
        await fs.unlink(currentPath)
      }
    }
    await fs.rmdir(folderPath)
  } catch (err) {
    console.error(`Error while deleting ${folderPath}.`, err)
  }
}

deleteFolderRecursive(path.join(__dirname, '../release')).then(() =>
  deleteFolderRecursive(path.join(__dirname, '../release-ow'))
)
