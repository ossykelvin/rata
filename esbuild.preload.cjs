const fs = require('node:fs')
const path = require('node:path')
const { buildSync } = require('esbuild')

const projectRoot = __dirname
const bridgeDirectory = path.join(projectRoot, 'electron', 'bridge')
const outputFile = path.join(projectRoot, 'dist-electron', 'preload.cjs')
const bridgeFiles = fs.readdirSync(bridgeDirectory, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.cjs') && !['compose.cjs', 'index.cjs'].includes(entry.name))
  .map(entry => entry.name)
  .sort()

if (bridgeFiles.length === 0) throw new Error('No preload bridge modules were found.')

const moduleImports = bridgeFiles
  .map((file, index) => `const bridge${index} = require(${JSON.stringify(`./electron/bridge/${file}`)})`)
  .join('\n')
const moduleReferences = bridgeFiles.map((_file, index) => `bridge${index}`).join(', ')
const entrySource = `
const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('./packages/contracts/ipc-channels.cjs')
const { installRataPreload } = require('./electron/preload.cjs')
${moduleImports}
installRataPreload({ contextBridge, ipcRenderer, IPC, modules: [${moduleReferences}] })
`

const result = buildSync({
  stdin: {
    contents: entrySource,
    loader: 'js',
    resolveDir: projectRoot,
    sourcefile: 'rata-preload-entry.cjs'
  },
  bundle: true,
  external: ['electron'],
  format: 'cjs',
  logLevel: 'info',
  metafile: true,
  outfile: outputFile,
  platform: 'node',
  target: 'node22'
})

const bundledInputs = new Set(Object.keys(result.metafile.inputs).map(input => path.resolve(projectRoot, input)))
for (const file of bridgeFiles) {
  const expected = path.join(bridgeDirectory, file)
  if (!bundledInputs.has(expected)) throw new Error(`Preload bundle omitted bridge module: ${file}`)
}

const output = fs.readFileSync(outputFile, 'utf8')
const forbiddenRequire = /\brequire\(["'](?!electron["'])[^"']+["']\)/
if (forbiddenRequire.test(output)) {
  throw new Error('Preload bundle contains a runtime require that is unavailable in the Electron sandbox.')
}

console.log(`Bundled sandboxed preload with ${bridgeFiles.length} bridge modules.`)
