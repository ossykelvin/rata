# ADR-008: Safe public web fetch boundary

Status: Proposed — requires Claude security review before acceptance

## Context

The `web-search` and `ai-research` skill fragments declare `web.fetch`, but the
runtime previously registered only `web.search`. Fetching a model- or
search-selected URL creates two separate boundaries: server-side request
forgery (SSRF) at the network layer and prompt injection when retrieved text is
given to an AI provider.

The configured Serper and Gemini credentials do not belong at this boundary.
Serper authorises search requests; Gemini authorises provider generation. A
public page fetch requires neither credential.

## Decision

**Credential separation.** `web.search` receives only a bound Serper search
capability. `web.fetch` receives no Serper or provider credential. Retrieved
content reaches Gemini only through the provider abstraction and its existing
`context` role.

**Public destinations only.** The fetch client accepts absolute HTTP(S) URLs
without embedded credentials. It rejects non-public IPv4 and IPv6 ranges,
including loopback, private, link-local, multicast, documentation and reserved
ranges. Only ports 80 and 443 are reachable. Every redirect is parsed and
resolved again, and an HTTPS request may not redirect down to plaintext HTTP.

**DNS answers are pinned.** Resolving a hostname and then handing the hostname
to a generic fetch implementation would leave a DNS-rebinding gap. Rata instead
connects to the vetted address while preserving the original Host header and
TLS server name. A mixed DNS response containing any non-public address fails
closed.

**Responses are bounded.** Fetches have a timeout, three-redirect ceiling,
128-KiB byte limit, and allow-list of readable text content types. HTML and
XHTML are parsed into a document tree; script, style, noscript, template, SVG,
iframe and object subtrees are discarded before visible text is collected.
The provider context is clamped further to 50,000 characters.

**External text remains data.** Tool results carry
`trust: untrusted-external`. Provider synthesis passes page text with the
`context` role, so `provider-contract.cjs` wraps it in the untrusted-content
fence. The model still has no executor or policy authority; fencing is defence
in depth, not the authority boundary.

**Confirmation.** `web.fetch` is a `read` tool with configurable confirmation
using its own default-on `webFetchConfirm` setting, separate from
`webSearchConfirm`. The approval preview names the destination and states that
the request leaves the machine. A Web Search skill workflow may approve search
plus the first-result fetch as one explicit composite read.

## Consequences

- The tool does not support authenticated pages, binary downloads, arbitrary
  protocols or private-network resources.
- Pages requiring client-side JavaScript may yield little readable text. A
  future Playwright browser lane remains separate and requires its own threat
  model and human consent for the browser download.
- New network and orchestration tests must inject DNS/request/provider
  capabilities and make no live requests.
- Changes to the address ranges, redirect policy, response limits or
  untrusted-content flow require security review.
