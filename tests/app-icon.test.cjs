const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

test('the dialog avatar is the Windows app, window, and tray icon', () => {
  assert.equal(fs.existsSync(path.join(root, 'public', '24_dialog_avatar_reply.png')), true)
  assert.match(main, /24_dialog_avatar_reply\.png/)
  assert.match(main, /APP_ID = 'uk\.koptechnology\.rata'/)
  assert.match(main, /setAppUserModelId\(APP_ID\)/)
  assert.match(main, /icon:\s*loadAppIcon\(\)/)
  assert.equal(pkg.build.win.icon, 'public/24_dialog_avatar_reply.png')
  assert.equal(
    pkg.build.extraResources.some(item => item.to === '24_dialog_avatar_reply.png'),
    true
  )
  assert.match(html, /24_dialog_avatar_reply\.png/)
})
