// Compatibility entry point for tests and downstream MVP consumers.
// Runtime composition lives in electron/tools/; new tool domains must be
// added there and must not extend this file.
const tools = require('./tools/index.cjs')
const { APP_ALLOW_LIST, isAllowListedApp } = require('./tools/system.cjs')

module.exports = { ...tools, APP_ALLOW_LIST, isAllowListedApp }
