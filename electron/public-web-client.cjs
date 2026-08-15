'use strict'

const dns = require('node:dns').promises
const http = require('node:http')
const https = require('node:https')
const net = require('node:net')

const MAX_URL_LENGTH = 2048
const MAX_RESPONSE_BYTES = 128 * 1024
const MAX_CONTENT_CHARS = 50000
const MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 15000
const ALLOWED_CONTENT_TYPES = Object.freeze(['text/html', 'application/xhtml+xml', 'text/plain', 'application/json'])

const blockedIpv4 = new net.BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
])
  blockedIpv4.addSubnet(network, prefix, 'ipv4')

const blockedIpv6 = new net.BlockList()
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
])
  blockedIpv6.addSubnet(network, prefix, 'ipv6')

function validatePublicUrlSyntax(input) {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('URL must be a non-empty string.')
  const raw = input.trim()
  if (raw.length > MAX_URL_LENGTH) throw new TypeError(`URL must be ${MAX_URL_LENGTH} characters or fewer.`)

  let target
  try {
    target = new URL(raw)
  } catch {
    throw new TypeError('URL must be an absolute HTTP(S) URL.')
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new TypeError('Only HTTP(S) URLs may be fetched.')
  }
  if (target.username || target.password) throw new TypeError('URLs containing credentials are not allowed.')
  if (!target.hostname) throw new TypeError('URL must include a hostname.')

  // Fragments never travel to the server and have no place in the audited
  // destination. Canonicalising here also keeps redirect comparisons stable.
  target.hash = ''
  return target
}

function isPublicAddress(address) {
  if (typeof address !== 'string' || address.includes('%')) return false
  const family = net.isIP(address)
  if (family === 4) return !blockedIpv4.check(address, 'ipv4')
  if (family === 6) return !blockedIpv6.check(address, 'ipv6')
  return false
}

async function resolvePublicAddress(hostname, lookup = dns.lookup) {
  const bareHostname = String(hostname).replace(/^\[|\]$/g, '')
  const literalFamily = net.isIP(bareHostname)
  const answers = literalFamily
    ? [{ address: bareHostname, family: literalFamily }]
    : await lookup(bareHostname, { all: true, verbatim: true })

  if (!Array.isArray(answers) || answers.length === 0) throw new Error('Web destination could not be resolved.')
  const normalized = answers.map(answer => ({ address: answer?.address, family: Number(answer?.family) }))
  if (normalized.some(answer => !isPublicAddress(answer.address) || ![4, 6].includes(answer.family))) {
    throw new Error('Web destination resolves to a non-public address.')
  }
  return normalized[0]
}

function pinnedRequest({ target, address, family, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const transport = target.protocol === 'https:' ? https : http
    const tlsName = target.hostname.replace(/^\[|\]$/g, '')
    const request = transport.request(
      {
        protocol: target.protocol,
        hostname: address,
        family,
        port: target.port || undefined,
        method: 'GET',
        path: `${target.pathname}${target.search}`,
        servername: net.isIP(tlsName) ? undefined : tlsName,
        headers: {
          host: target.host,
          accept: ALLOWED_CONTENT_TYPES.join(', '),
          'user-agent': 'Rata-Office-Assistant/0.1'
        }
      },
      resolve
    )

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('timeout'))
    })
    request.on('error', reject)
    request.end()
  })
}

function readBoundedBody(response, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(response.headers['content-length'])
    if (Number.isFinite(declared) && declared > maxBytes) {
      response.resume()
      reject(new Error(`Web response exceeds the ${maxBytes}-byte limit.`))
      return
    }

    const chunks = []
    let total = 0
    response.on('data', chunk => {
      total += chunk.length
      if (total > maxBytes) {
        response.destroy(new Error('response-too-large'))
        return
      }
      chunks.push(chunk)
    })
    response.on('end', () => resolve(Buffer.concat(chunks, total)))
    response.on('error', error => {
      if (error?.message === 'response-too-large') {
        reject(new Error(`Web response exceeds the ${maxBytes}-byte limit.`))
      } else {
        reject(new Error('Web response could not be read.'))
      }
    })
  })
}

function decodeEntities(text) {
  const named = Object.freeze({ amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' })
  return String(text).replace(/&(#\d+|#x[\da-f]+|amp|apos|gt|lt|nbsp|quot);/gi, (_match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] || ' '
    const radix = entity[1].toLowerCase() === 'x' ? 16 : 10
    const digits = radix === 16 ? entity.slice(2) : entity.slice(1)
    const point = Number.parseInt(digits, radix)
    return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' '
  })
}

function extractReadableContent(body, contentType) {
  const source = body.toString('utf8')
  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
    return { title: '', content: source.replace(/\0/g, '').trim().slice(0, MAX_CONTENT_CHARS) }
  }

  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const title = decodeEntities(titleMatch?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
  const content = decodeEntities(
    source
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, MAX_CONTENT_CHARS)

  return { title, content }
}

function createPublicWebFetch({
  lookup = dns.lookup,
  requestImpl = pinnedRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_RESPONSE_BYTES,
  maxRedirects = MAX_REDIRECTS
} = {}) {
  async function fetchPublic(input) {
    let target = validatePublicUrlSyntax(input)

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      let resolved
      try {
        resolved = await resolvePublicAddress(target.hostname, lookup)
      } catch (error) {
        if (error?.message?.startsWith('Web destination')) throw error
        // eslint-disable-next-line preserve-caught-error -- DNS errors can contain local resolver details
        throw new Error('Web destination could not be resolved.')
      }

      let response
      try {
        response = await requestImpl({ target, ...resolved, timeoutMs })
      } catch (error) {
        // Raw socket errors may contain local addresses or request internals.
        // eslint-disable-next-line preserve-caught-error -- deliberately replace sensitive socket details
        throw new Error(error?.message === 'timeout' ? 'Web fetch timed out.' : 'Web fetch request failed.')
      }

      const status = Number(response.statusCode || 0)
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location
        response.resume()
        if (!location) throw new Error('Web fetch returned a redirect without a destination.')
        if (redirectCount === maxRedirects) throw new Error('Web fetch exceeded the redirect limit.')
        target = validatePublicUrlSyntax(new URL(location, target).toString())
        continue
      }
      if (status < 200 || status >= 300) {
        response.resume()
        throw new Error(`Web fetch returned HTTP ${status}.`)
      }

      const contentType = String(response.headers['content-type'] || '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase()
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        response.resume()
        throw new Error('Web fetch refused an unsupported content type.')
      }

      const body = await readBoundedBody(response, maxBytes)
      const extracted = extractReadableContent(body, contentType)
      if (!extracted.content) throw new Error('Web fetch returned no readable text.')
      return {
        url: target.toString(),
        contentType,
        title: extracted.title,
        content: extracted.content,
        trust: 'untrusted-external'
      }
    }

    throw new Error('Web fetch exceeded the redirect limit.')
  }

  return fetchPublic
}

module.exports = {
  createPublicWebFetch,
  validatePublicUrlSyntax,
  isPublicAddress,
  resolvePublicAddress,
  extractReadableContent,
  MAX_URL_LENGTH,
  MAX_RESPONSE_BYTES,
  MAX_CONTENT_CHARS,
  MAX_REDIRECTS,
  ALLOWED_CONTENT_TYPES
}
