const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { createMvpRegistry } = require('../electron/tools/index.cjs')
const { createSkillRegistry } = require('../packages/skills/registry.cjs')
const documentModule = require('../electron/tools/document.cjs')
const {
  sanitizeInterpolatedText,
  MAX_SLIDES,
  MAX_BULLETS
} = require('../electron/tools/document.cjs')

const ROOT = path.join(__dirname, '..')

function documentRegistry() {
  const registry = new ToolRegistry()
  for (const definition of documentModule.create()) registry.register(definition)
  return registry
}

function composedRegistry() {
  return createMvpRegistry({
    spawnProcess: () => ({ unref() {} }),
    clipboardApi: { writeText() {} }
  })
}

test('document.create, presentation.create and presentation.render declare risk and confirmation', () => {
  const registry = documentRegistry()
  const expected = {
    'document.create': ['read', 'never'],
    'presentation.create': ['read', 'never'],
    'presentation.render': ['read', 'never']
  }
  for (const [id, [risk, confirmation]] of Object.entries(expected)) {
    const meta = registry.describe(id)
    assert.ok(meta, `${id} is not registered`)
    assert.equal(meta.risk, risk, `${id} risk`)
    assert.equal(meta.confirmation, confirmation, `${id} confirmation`)
  }
})

test('document.create emits markdown by default and optional escaped HTML', async () => {
  const registry = documentRegistry()
  const markdown = await registry.execute('document.create', {
    title: 'Quarterly memo',
    sections: [{ heading: 'Summary', body: 'Ship the MVP.' }]
  })
  assert.equal(markdown.format, 'markdown')
  assert.match(markdown.content, /# Quarterly memo/)
  assert.match(markdown.content, /## Summary/)
  assert.equal(typeof markdown.byteLength, 'number')

  const html = await registry.execute('document.create', {
    title: '<script>alert(1)</script>',
    markdown: '<script>alert(1)</script>',
    format: 'html'
  })
  assert.equal(html.format, 'html')
  assert.doesNotMatch(html.content, /<script>/i)
  assert.match(html.content, /&lt;script&gt;/)
})

test('presentation.create caps slides and bullets and drops extra fields', async () => {
  const registry = documentRegistry()
  const deck = await registry.execute('presentation.create', {
    title: 'Kickoff',
    slides: [{ heading: 'Goals', bullets: ['Ship', 'Review'] }],
    rawHtml: '<script>alert(1)</script>'
  })
  assert.equal(deck.slideCount, 1)
  assert.equal(Object.hasOwn(deck, 'rawHtml'), false)
  assert.deepEqual(deck.slides[0].bullets, ['Ship', 'Review'])

  await assert.rejects(
    () => registry.execute('presentation.create', {
      title: 'Too many',
      slides: Array.from({ length: MAX_SLIDES + 1 }, (_, index) => ({ heading: `S${index}`, bullets: [] }))
    }),
    /at most 50 slides/
  )
  await assert.rejects(
    () => registry.execute('presentation.create', {
      title: 'Too many bullets',
      slides: [{ heading: 'One', bullets: Array.from({ length: MAX_BULLETS + 1 }, (_, index) => `b${index}`) }]
    }),
    /at most 12 bullets/
  )
})

test('presentation.render revalidates the deck and does not trust extra fields', async () => {
  const registry = documentRegistry()
  await assert.rejects(
    () => registry.execute('presentation.render', {
      title: 'Deck',
      slides: Array.from({ length: MAX_SLIDES + 1 }, (_, index) => ({ heading: `S${index}`, bullets: [] })),
      rawHtml: '<script>alert(1)</script>'
    }),
    /at most 50 slides/
  )
  const rendered = await registry.execute('presentation.render', {
    title: 'Deck',
    slides: [{ heading: 'One', bullets: ['A'] }],
    rawHtml: '<script>alert(1)</script>'
  })
  assert.equal(rendered.format, 'html')
  assert.doesNotMatch(rendered.content, /<script>/i)
  assert.equal(Object.hasOwn(rendered, 'rawHtml'), false)
})

test('script alert in title, heading and bullet is escaped, not executable', async () => {
  const registry = documentRegistry()
  const payload = '<script>alert(1)</script>'
  const deck = await registry.execute('presentation.create', {
    title: payload,
    slides: [{ heading: payload, bullets: [payload] }]
  })
  const { content } = await registry.execute('presentation.render', deck)
  assert.doesNotMatch(content, /<script>/i)
  assert.match(content, /&lt;script&gt;/)
  assert.equal((content.match(/&lt;script&gt;/g) || []).length >= 3, true)
})

test('javascript: and data: URLs do not survive rendering', async () => {
  const registry = documentRegistry()
  const deck = await registry.execute('presentation.create', {
    title: 'Links',
    slides: [{
      heading: 'javascript:alert(1)',
      bullets: ['data:text/html,xss', 'DATA:image/png,abc', 'JAVASCRIPT:alert(1)']
    }]
  })
  const { content } = await registry.execute('presentation.render', deck)
  assert.doesNotMatch(content, /javascript:/i)
  assert.doesNotMatch(content, /data:/i)
})

test('onerror= in text does not become an attribute', async () => {
  const registry = documentRegistry()
  const deck = await registry.execute('presentation.create', {
    title: 'Img',
    slides: [{ heading: 'Hello', bullets: ['<img src=x onerror=alert(1)>'] }]
  })
  const { content } = await registry.execute('presentation.render', deck)
  assert.doesNotMatch(content, /onerror=/i)
  assert.doesNotMatch(content, /<img /i)
})

test('rendering already-escaped output does not double-escape into visible &amp;lt;', async () => {
  const registry = documentRegistry()
  const deck = await registry.execute('presentation.create', {
    title: '&lt;b&gt;Hi&lt;/b&gt;',
    slides: [{ heading: '&lt;script&gt;', bullets: ['&lt;img&gt;'] }]
  })
  const { content } = await registry.execute('presentation.render', deck)
  assert.doesNotMatch(content, /&amp;lt;/)
  assert.match(content, /&lt;script&gt;/)
})

test('sanitizeInterpolatedText never emits a live script, style, or URL scheme', () => {
  const hostile = '<script>alert(1)</script> javascript:alert(1) data:text/html,x onerror=alert(1)'
  const safe = sanitizeInterpolatedText(hostile)
  assert.doesNotMatch(safe, /<script>/i)
  assert.doesNotMatch(safe, /javascript:/i)
  assert.doesNotMatch(safe, /data:/i)
  assert.doesNotMatch(safe, /onerror=/i)
})

test('document-assistant and presentation-builder report available against a composed registry', () => {
  const tools = composedRegistry()
  const skills = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const wanted = Object.fromEntries(
    skills.list()
      .filter(skill => skill.id === 'document-assistant' || skill.id === 'presentation-builder')
      .map(skill => [skill.id, skill])
  )
  assert.equal(wanted['document-assistant'].status, 'ready')
  assert.deepEqual(wanted['document-assistant'].missingTools, [])
  assert.equal(wanted['presentation-builder'].status, 'ready')
  assert.deepEqual(wanted['presentation-builder'].missingTools, [])
})
