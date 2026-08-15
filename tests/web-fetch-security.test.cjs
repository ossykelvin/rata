const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

const {
  createPublicWebFetch,
  validatePublicUrlSyntax,
  isPublicAddress,
  resolvePublicAddress,
  extractReadableContent,
  MAX_URL_LENGTH,
  MAX_CONTENT_CHARS
} = require('../electron/public-web-client.cjs')

// Lane H coverage for WEB-001 (issue #39).
//
// web.fetch is the first tool that opens an outbound connection to a host the
// user did not type. Its whole security value is refusing destinations, so
// every test here asserts a refusal, or asserts that a pinned connection went
// exactly where it was vetted to go.
//
// No test performs real DNS or HTTP. `lookup` and `requestImpl` are injected.

/** A response object shaped like http.IncomingMessage, with a body. */
function fakeResponse({ statusCode = 200, headers = {}, body = '', chunkSize = 1024 } = {}) {
  const response = new EventEmitter()
  response.statusCode = statusCode
  response.headers = { 'content-type': 'text/html', ...headers }
  let destroyed = false
  response.resume = () => {}
  // A destroyed stream stops delivering and never reaches 'end'.
  response.destroy = error => { destroyed = true; setImmediate(() => response.emit('error', error)) }
  setImmediate(() => {
    const buffer = Buffer.from(body)
    for (let offset = 0; offset < buffer.length && !destroyed; offset += chunkSize) {
      response.emit('data', buffer.subarray(offset, offset + chunkSize))
    }
    if (!destroyed) response.emit('end')
  })
  return response
}

const publicAnswer = [{ address: '93.184.216.34', family: 4 }]
const lookupPublic = async () => publicAnswer

/** Records what the transport was asked to connect to. */
function recordingRequest(responses) {
  const calls = []
  const queue = Array.isArray(responses) ? [...responses] : [responses]
  const requestImpl = async options => {
    calls.push(options)
    const next = queue.shift()
    if (typeof next === 'function') return next(options)
    return next || fakeResponse({ body: '<html><body>ok</body></html>' })
  }
  return { calls, requestImpl }
}

// --- URL syntax ---------------------------------------------------------

test('only absolute public HTTP(S) URLs are accepted', () => {
  for (const good of ['http://example.com/a', 'https://example.com/a?b=c']) {
    assert.ok(validatePublicUrlSyntax(good))
  }
  const bad = [
    ['', /non-empty/],
    ['   ', /non-empty/],
    ['/relative/path', /absolute HTTP/],
    ['example.com', /absolute HTTP/],
    ['file:///etc/passwd', /Only HTTP/],
    ['ftp://example.com', /Only HTTP/],
    ['javascript:alert(1)', /Only HTTP/],
    ['data:text/html,<b>x', /Only HTTP/],
    ['http://user:pass@example.com', /credentials/],
    ['http://user@example.com', /credentials/],
    [`https://example.com/${'x'.repeat(MAX_URL_LENGTH)}`, /characters or fewer/]
  ]
  for (const [input, expected] of bad) {
    assert.throws(() => validatePublicUrlSyntax(input), expected, `accepted: ${input}`)
  }
})

test('fragments are stripped so the audited destination is what is sent', () => {
  const target = validatePublicUrlSyntax('https://example.com/page#secret-anchor')
  assert.equal(target.hash, '')
  assert.equal(target.toString().includes('#'), false)
})

// --- address classification --------------------------------------------

test('private, loopback and reserved addresses are refused', () => {
  const blocked = [
    '127.0.0.1', '127.9.9.9', '0.0.0.0', '10.1.2.3', '172.16.5.4', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1', '192.0.2.5', '198.51.100.7',
    '203.0.113.9', '224.0.0.1', '240.0.0.1', '198.18.0.1',
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '2001:db8::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1'
  ]
  for (const address of blocked) {
    assert.equal(isPublicAddress(address), false, `treated as public: ${address}`)
  }
})

test('genuinely public addresses are allowed', () => {
  for (const address of ['93.184.216.34', '8.8.8.8', '2606:2800:220:1:248:1893:25c8:1946']) {
    assert.equal(isPublicAddress(address), true, `treated as private: ${address}`)
  }
})

test('zone identifiers and non-addresses are refused', () => {
  for (const address of ['fe80::1%eth0', '::1%1', 'example.com', '', null, undefined, 42, '999.999.999.999']) {
    assert.equal(isPublicAddress(address), false, `treated as public: ${String(address)}`)
  }
})

test('IPv4-mapped IPv6 cannot smuggle a private address through', () => {
  assert.equal(isPublicAddress('::ffff:169.254.169.254'), false)
  assert.equal(isPublicAddress('::ffff:192.168.0.1'), false)
})

// --- DNS resolution -----------------------------------------------------

test('a hostname resolving to any private address is refused outright', async () => {
  const mixed = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '127.0.0.1', family: 4 }
  ]
  await assert.rejects(() => resolvePublicAddress('mixed.example', mixed), /non-public address/)
})

test('an empty or unresolvable answer is refused', async () => {
  await assert.rejects(() => resolvePublicAddress('nx.example', async () => []), /could not be resolved/)
})

test('literal IP hosts skip DNS but are still classified', async () => {
  let called = false
  const spy = async () => { called = true; return [] }
  const resolved = await resolvePublicAddress('93.184.216.34', spy)
  assert.equal(resolved.address, '93.184.216.34')
  assert.equal(called, false, 'a literal address triggered a DNS lookup')
  await assert.rejects(() => resolvePublicAddress('127.0.0.1', spy), /non-public address/)
})

// --- DNS rebinding ------------------------------------------------------

// Note: pinnedRequest() is not exported, so the Host header and TLS
// servername it sets cannot be asserted here. What is assertable is that the
// vetted address - not the hostname - is what reaches the transport, and that
// the original target travels alongside it for Host/SNI. See the review note
// on #40 requesting that pinnedRequest be exported.
test('the vetted address, not the hostname, is what reaches the transport', async () => {
  const { calls, requestImpl } = recordingRequest(fakeResponse({ body: '<html>ok</html>' }))
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  await fetchPublic('https://example.com/page')

  assert.equal(calls.length, 1)
  // The transport is handed the vetted IP...
  assert.equal(calls[0].address, '93.184.216.34')
  assert.equal(calls[0].family, 4)
  // ...plus the original target, so Host and SNI can still name the site.
  assert.equal(calls[0].target.hostname, 'example.com')
  assert.equal(calls[0].target.protocol, 'https:')
})

test('a rebinding answer that flips to private between hops is refused', async () => {
  let call = 0
  const flipping = async () => (call++ === 0 ? publicAnswer : [{ address: '169.254.169.254', family: 4 }])
  const { requestImpl } = recordingRequest([
    fakeResponse({ statusCode: 302, headers: { location: 'https://second.example/next' } })
  ])
  const fetchPublic = createPublicWebFetch({ lookup: flipping, requestImpl })
  await assert.rejects(() => fetchPublic('https://first.example/a'), /non-public address/)
})

// --- redirects ----------------------------------------------------------

test('every redirect hop is re-resolved and re-validated', async () => {
  const seen = []
  const lookup = async hostname => { seen.push(hostname); return publicAnswer }
  const { requestImpl } = recordingRequest([
    fakeResponse({ statusCode: 301, headers: { location: 'https://second.example/b' } }),
    fakeResponse({ body: '<html>done</html>' })
  ])
  const fetchPublic = createPublicWebFetch({ lookup, requestImpl })
  const result = await fetchPublic('https://first.example/a')

  assert.deepEqual(seen, ['first.example', 'second.example'], 'the redirect target was not re-resolved')
  assert.equal(result.url, 'https://second.example/b')
})

test('a redirect to a private destination is refused', async () => {
  const lookup = async hostname =>
    hostname === 'internal.example' ? [{ address: '10.0.0.5', family: 4 }] : publicAnswer
  const { requestImpl } = recordingRequest([
    fakeResponse({ statusCode: 302, headers: { location: 'http://internal.example/admin' } })
  ])
  const fetchPublic = createPublicWebFetch({ lookup, requestImpl })
  await assert.rejects(() => fetchPublic('https://public.example/a'), /non-public address/)
})

test('a redirect to a non-HTTP scheme is refused', async () => {
  const { requestImpl } = recordingRequest([
    fakeResponse({ statusCode: 302, headers: { location: 'file:///etc/passwd' } })
  ])
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /Only HTTP/)
})

test('a redirect without a destination is refused', async () => {
  const { requestImpl } = recordingRequest([fakeResponse({ statusCode: 302, headers: {} })])
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /redirect without a destination/)
})

test('redirect chains are bounded', async () => {
  const responses = Array.from({ length: 10 }, (_unused, index) =>
    fakeResponse({ statusCode: 302, headers: { location: `https://hop${index}.example/` } })
  )
  const { requestImpl } = recordingRequest(responses)
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl, maxRedirects: 2 })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /redirect limit/)
})

// --- response limits ----------------------------------------------------

test('a declared over-limit content-length is refused before reading the body', async () => {
  const { requestImpl } = recordingRequest(
    fakeResponse({ headers: { 'content-length': String(10 * 1024 * 1024) }, body: 'x' })
  )
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl, maxBytes: 1024 })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /exceeds the .* limit/)
})

test('a body that lies about its size is cut off mid-stream', async () => {
  const { requestImpl } = recordingRequest(
    fakeResponse({ headers: { 'content-length': '10' }, body: 'y'.repeat(20000), chunkSize: 256 })
  )
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl, maxBytes: 2048 })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /exceeds the .* limit/)
})

test('only allow-listed content types are accepted', async () => {
  for (const contentType of ['application/pdf', 'image/png', 'application/octet-stream', 'text/csv', '']) {
    const { requestImpl } = recordingRequest(fakeResponse({ headers: { 'content-type': contentType }, body: 'x' }))
    const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
    await assert.rejects(() => fetchPublic('https://example.com/a'), /unsupported content type/, contentType)
  }
})

test('non-2xx responses are refused', async () => {
  for (const statusCode of [400, 401, 403, 404, 418, 500, 503]) {
    const { requestImpl } = recordingRequest(fakeResponse({ statusCode, body: 'x' }))
    const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
    await assert.rejects(() => fetchPublic('https://example.com/a'), new RegExp(`HTTP ${statusCode}`))
  }
})

test('an empty page is reported rather than returned as content', async () => {
  const { requestImpl } = recordingRequest(fakeResponse({ body: '<html><body>   </body></html>' }))
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /no readable text/)
})

test('a timeout is reported without leaking socket internals', async () => {
  const requestImpl = async () => { throw new Error('timeout') }
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  await assert.rejects(() => fetchPublic('https://example.com/a'), /timed out/)
})

test('transport errors never surface local details', async () => {
  const requestImpl = async () => { throw new Error('connect ECONNREFUSED 10.0.0.1:8080 local=192.168.1.5') }
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  await assert.rejects(
    () => fetchPublic('https://example.com/a'),
    error => {
      assert.equal(/10\.0\.0\.1|192\.168\.1\.5/.test(error.message), false, 'a local address leaked')
      return /request failed/.test(error.message)
    }
  )
})

test('DNS errors never surface resolver details', async () => {
  const lookup = async () => { throw new Error('queryA ENOTFOUND via resolver 192.168.1.1') }
  const fetchPublic = createPublicWebFetch({ lookup, requestImpl: async () => fakeResponse({}) })
  await assert.rejects(
    () => fetchPublic('https://example.com/a'),
    error => {
      assert.equal(error.message.includes('192.168.1.1'), false, 'a resolver address leaked')
      return /could not be resolved/.test(error.message)
    }
  )
})

// --- content extraction -------------------------------------------------

test('markup, scripts and styles are stripped from extracted text', () => {
  const html = [
    '<html><head><title>Title &amp; more</title><style>.a{color:red}</style></head>',
    '<body><script>alert("xss")</script><p>Hello</p>',
    '<svg><text>vector</text></svg><noscript>nojs</noscript>',
    '<template><b>tpl</b></template><p>World</p></body></html>'
  ].join('')
  const { title, content } = extractReadableContent(Buffer.from(html), 'text/html')

  assert.equal(title, 'Title & more')
  assert.match(content, /Hello/)
  assert.match(content, /World/)
  for (const leaked of ['alert(', 'color:red', 'vector', 'nojs', 'tpl', '<p>', '<script']) {
    assert.equal(content.includes(leaked), false, `extraction leaked: ${leaked}`)
  }
})

test('extracted content is clamped', () => {
  const html = `<html><body><p>${'a'.repeat(MAX_CONTENT_CHARS * 2)}</p></body></html>`
  const { content } = extractReadableContent(Buffer.from(html), 'text/html')
  assert.ok(content.length <= MAX_CONTENT_CHARS)
})

test('non-HTML types are returned as plain text without markup handling', () => {
  const { content, title } = extractReadableContent(Buffer.from('{"a":1}'), 'application/json')
  assert.equal(title, '')
  assert.equal(content, '{"a":1}')
})

test('a successful fetch labels its own result untrusted', async () => {
  const { requestImpl } = recordingRequest(fakeResponse({ body: '<html><title>T</title><body>Body text</body></html>' }))
  const fetchPublic = createPublicWebFetch({ lookup: lookupPublic, requestImpl })
  const result = await fetchPublic('https://example.com/a')

  assert.equal(result.trust, 'untrusted-external')
  assert.equal(result.contentType, 'text/html')
  assert.match(result.content, /Body text/)
})
