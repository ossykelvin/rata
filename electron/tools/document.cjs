'use strict'

/**
 * Document and presentation generation (RATA-013).
 *
 * Pure content transforms — no I/O. Saving is `file.save`, a different tool
 * with a different contract. v1 emits Markdown or self-contained HTML, not
 * Microsoft Word (.docx) or PowerPoint (.pptx). There is no document library.
 *
 * User text is never accepted as HTML. Every interpolated value is sanitised
 * and escaped; an unescaped deck is stored XSS.
 */

const TITLE_MAX = 200
const MARKDOWN_MAX = 400_000
const SECTION_MAX = 80
const SECTION_HEADING_MAX = 200
const SECTION_BODY_MAX = 20_000
const MAX_SLIDES = 50
const MAX_BULLETS = 12
const SLIDE_HEADING_MAX = 200
const BULLET_MAX = 500

const NAMED_ENTITIES = Object.assign(Object.create(null), {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
})

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

function clampString(value, max, label, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`)
  }
  const trimmed = value.trim()
  if (!allowEmpty && !trimmed) {
    throw new TypeError(`${label} is required.`)
  }
  return trimmed.slice(0, max)
}

function unescapeHtmlEntities(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code < 1) return ''
      try {
        return String.fromCodePoint(code)
      } catch {
        return ''
      }
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : match
  })
}

/**
 * Decode one layer of entities, strip active-content schemes, then escape.
 * Decoding first is what stops already-escaped input from rendering as
 * visible `&amp;lt;`.
 */
function sanitizeInterpolatedText(value) {
  const decoded = unescapeHtmlEntities(String(value == null ? '' : value))
  const neutralized = decoded
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/on[a-z]+\s*=/gi, 'onhandler-')
  return escapeHtml(neutralized)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseSections(sections) {
  if (!Array.isArray(sections)) {
    throw new TypeError('sections must be an array of strings or { heading, body } objects.')
  }
  if (sections.length > SECTION_MAX) {
    throw new TypeError(`A document may have at most ${SECTION_MAX} sections.`)
  }
  return sections.map((section, index) => {
    if (typeof section === 'string') {
      return { heading: `Section ${index + 1}`, body: clampString(section, SECTION_BODY_MAX, `sections[${index}]`, { allowEmpty: true }) }
    }
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw new TypeError(`sections[${index}] must be a string or an object.`)
    }
    return {
      heading: clampString(section.heading, SECTION_HEADING_MAX, `sections[${index}].heading`),
      body: clampString(section.body == null ? '' : section.body, SECTION_BODY_MAX, `sections[${index}].body`, { allowEmpty: true })
    }
  })
}

function parseDocumentInput(input) {
  const value = requireObject(input, 'document.create')
  const title = clampString(value.title, TITLE_MAX, 'title')
  let format = 'markdown'
  if (value.format !== undefined) {
    if (value.format !== 'markdown' && value.format !== 'html') {
      throw new TypeError('document.create format must be markdown or html.')
    }
    format = value.format
  }
  if (typeof value.markdown === 'string') {
    return {
      title,
      markdown: clampString(value.markdown, MARKDOWN_MAX, 'markdown', { allowEmpty: true }),
      format,
      mode: 'markdown'
    }
  }
  if (Array.isArray(value.sections)) {
    return { title, sections: parseSections(value.sections), format, mode: 'sections' }
  }
  throw new TypeError('document.create requires markdown or sections.')
}

function toMarkdown({ title, markdown, sections, mode }) {
  if (mode === 'markdown') {
    return `# ${title}\n\n${markdown}`.trim() + '\n'
  }
  const parts = [`# ${title}`, '']
  for (const section of sections) {
    parts.push(`## ${section.heading}`, '', section.body, '')
  }
  return parts.join('\n').trim() + '\n'
}

function toDocumentHtml({ title, markdown, sections, mode }) {
  const body = mode === 'markdown'
    ? `<pre>${sanitizeInterpolatedText(markdown)}</pre>`
    : sections.map(section => (
      `<section><h2>${sanitizeInterpolatedText(section.heading)}</h2><p>${sanitizeInterpolatedText(section.body)}</p></section>`
    )).join('\n')
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${sanitizeInterpolatedText(title)}</title>`,
    '<style>body{font-family:Segoe UI,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}pre{white-space:pre-wrap}</style>',
    '</head>',
    `<body><h1>${sanitizeInterpolatedText(title)}</h1>${body}</body>`,
    '</html>',
    ''
  ].join('\n')
}

function createDocument(input) {
  const parsed = parseDocumentInput(input)
  const content = parsed.format === 'html' ? toDocumentHtml(parsed) : toMarkdown(parsed)
  return {
    format: parsed.format,
    content,
    byteLength: Buffer.byteLength(content, 'utf8'),
    title: parsed.title
  }
}

function parseDeck(input, toolId) {
  const value = requireObject(input, toolId)
  const title = clampString(value.title, TITLE_MAX, 'title')
  if (!Array.isArray(value.slides)) {
    throw new TypeError(`${toolId} requires a slides array.`)
  }
  if (value.slides.length < 1) {
    throw new TypeError(`${toolId} requires at least one slide.`)
  }
  if (value.slides.length > MAX_SLIDES) {
    throw new TypeError(`A presentation may have at most ${MAX_SLIDES} slides.`)
  }
  const slides = value.slides.map((slide, index) => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
      throw new TypeError(`slides[${index}] must be an object.`)
    }
    const heading = clampString(slide.heading, SLIDE_HEADING_MAX, `slides[${index}].heading`)
    if (!Array.isArray(slide.bullets)) {
      throw new TypeError(`slides[${index}].bullets must be an array.`)
    }
    if (slide.bullets.length > MAX_BULLETS) {
      throw new TypeError(`A slide may have at most ${MAX_BULLETS} bullets.`)
    }
    const bullets = slide.bullets.map((bullet, bulletIndex) => {
      if (typeof bullet !== 'string') {
        throw new TypeError(`slides[${index}].bullets[${bulletIndex}] must be a string.`)
      }
      return clampString(bullet, BULLET_MAX, `slides[${index}].bullets[${bulletIndex}]`, { allowEmpty: true })
    })
    return { heading, bullets }
  })
  return { title, slides }
}

function createPresentation(input) {
  const deck = parseDeck(input, 'presentation.create')
  return {
    title: deck.title,
    slides: deck.slides,
    slideCount: deck.slides.length
  }
}

function renderPresentation(input) {
  const deck = parseDeck(input, 'presentation.render')
  const slides = deck.slides.map((slide, index) => {
    const items = slide.bullets
      .map(bullet => `<li>${sanitizeInterpolatedText(bullet)}</li>`)
      .join('')
    return [
      `<section class="slide" id="slide-${index + 1}">`,
      `<p class="slide-index">${index + 1} / ${deck.slides.length}</p>`,
      `<h2>${sanitizeInterpolatedText(slide.heading)}</h2>`,
      items ? `<ul>${items}</ul>` : '',
      '</section>'
    ].join('')
  }).join('\n')
  const content = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${sanitizeInterpolatedText(deck.title)}</title>`,
    '<style>',
    'html,body{margin:0;background:#111827;color:#f9fafb;font-family:Segoe UI,sans-serif}',
    '.deck{min-height:100vh}',
    '.slide{box-sizing:border-box;min-height:100vh;padding:8vh 10vw;border-bottom:1px solid #1f2937}',
    'h1,h2{font-weight:650}',
    'h1{font-size:2.4rem;padding:8vh 10vw}',
    'h2{font-size:2rem;margin:0 0 1rem}',
    'ul{font-size:1.25rem;line-height:1.45}',
    '.slide-index{opacity:.55;font-size:.9rem}',
    '</style>',
    '</head>',
    '<body>',
    `<main class="deck"><h1>${sanitizeInterpolatedText(deck.title)}</h1>${slides}</main>`,
    '</body>',
    '</html>',
    ''
  ].join('\n')
  return {
    format: 'html',
    content,
    byteLength: Buffer.byteLength(content, 'utf8'),
    title: deck.title,
    slideCount: deck.slides.length
  }
}

function create() {
  return [
    {
      id: 'document.create',
      description:
        'Draft a Markdown document, or optional HTML. This is not a Word .docx file.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => parseDocumentInput(input),
      execute: async input => {
        const created = createDocument(input)
        return {
          ...created,
          summary: `Created ${created.format} document`,
          message: `I drafted a ${created.format} document (${created.byteLength} bytes). This is Markdown/HTML, not a Word file.`
        }
      }
    },
    {
      id: 'presentation.create',
      description:
        'Build a slide deck from a title and slides. Rendering to HTML is a separate tool; this is not PowerPoint.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => parseDeck(input, 'presentation.create'),
      execute: async input => {
        const deck = createPresentation(input)
        return {
          ...deck,
          summary: `Created ${deck.slideCount}-slide deck`,
          message: `I prepared a ${deck.slideCount}-slide deck titled “${deck.title}”. Render it to HTML next — this is not a PowerPoint file.`
        }
      }
    },
    {
      id: 'presentation.render',
      description:
        'Render a slide deck to a self-contained HTML file. This is not PowerPoint. The deck is revalidated and every value is HTML-escaped.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => parseDeck(input, 'presentation.render'),
      execute: async input => {
        const rendered = renderPresentation(input)
        return {
          ...rendered,
          summary: `Rendered ${rendered.slideCount}-slide HTML deck`,
          message: `I rendered a self-contained HTML deck (${rendered.byteLength} bytes). This is HTML, not a .pptx file.`
        }
      }
    }
  ]
}

module.exports = {
  id: 'document',
  toolIds: ['document.create', 'presentation.create', 'presentation.render'],
  create,
  createDocument,
  createPresentation,
  renderPresentation,
  parseDeck,
  sanitizeInterpolatedText,
  escapeHtml,
  MAX_SLIDES,
  MAX_BULLETS
}
