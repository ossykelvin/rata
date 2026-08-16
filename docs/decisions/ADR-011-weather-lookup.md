# ADR-011: Weather lookup boundary

Status: Proposed — requires Claude security review before acceptance

## Context

The Weatherman skill reports current conditions for a place the user names. It
needs one outbound call to WeatherAPI.com, authenticated with an API key.

This is the third credentialed outbound integration, after Serper (`web.search`)
and the AI providers. It repeats their shape in most respects, and differs in
one that drives the design.

**Serper accepts its key in a request header. WeatherAPI accepts it only as a
`key=` query parameter.** The request URL is therefore itself a secret. Any code
path that logs a URL, embeds one in an error, or returns one to the renderer
leaks the credential. Node's own network errors routinely include the URL, so
the default behaviour of "wrap and rethrow" is unsafe here.

## Decision

**The key is configuration, never code.** It is read from `WEATHER_API_KEY`
(optionally `WEATHER_API_BASE_URL` to override the endpoint) by
`electron/config.cjs`, kept in the main process, and captured inside the client
closure built by `electron/weather-client.cjs`. What the tool layer receives is
a bound `getCurrentWeather(query)` capability, not the key — so a module
discovered from `electron/tools/` can request weather but cannot read, log or
exfiltrate the credential. `describeConfig()` reports presence as a boolean.
No key appears in source, tests, fixtures, logs or audit events.

**No error may carry the URL.** Every failure path returns a fixed string:
timeout, transport failure, rejected key, unmatched location, non-2xx status
and unreadable JSON. The caught error is deliberately discarded rather than
wrapped, because it can contain the credentialed URL.

**The response is mapped, not passed through.** `shapeCurrentWeather()` copies a
fixed set of fields onto a known shape. Unmodelled provider fields never reach
the agent, numeric fields become `null` rather than `NaN` when malformed, and
text fields are stripped of control characters and clamped to 120 characters.
A payload missing `location` or `current` is rejected outright.

**Weather data is untrusted.** The result carries
`trust: 'untrusted-external'`, the same label `web.fetch` and `file.readText`
use. `condition` is third-party text; it is data to report, never an
instruction, and it never grants permission to act.

**Locations are validated to place names, postcodes and coordinates.** The
provider also understands `auto:ip`, `iata:`, `id:` and `metar:` prefixes.
Those are refused. `auto:ip` silently geolocates the user from their IP
address, which is a materially different privacy decision from looking up a
place the user named, and it should be an explicit product choice rather than a
side effect of a permissive validator.

**Lookups are confirmed by default** via a new `weatherConfirm` setting. The
location the user asks about leaves the machine and reaches a third party,
which is the same boundary `webSearchConfirm` guards. Users who ask about
weather often can turn it off in Control Center.

**Routing is deterministic.** The location is extracted from the user's message
by a regular expression in `MockAgent.handle()` and passed to the tool
directly. No provider sees the request before the tool runs, and no model
chooses the location — unlike ADR-009, where a provider proposes a strictly
validated action. A weather question with no place asks which place rather than
guessing, and never assumes the user's own location.

## Consequences

The Weatherman skill becomes available; blocked skills drop from 12 to 11.

Only current conditions are supported. Forecast phrasing is deliberately *not*
matched by the deterministic route, so "what's the forecast tomorrow" is not
answered with today's readings; it falls through to the ordinary provider path,
and the skill prompt instructs the model to say it only has current conditions.

Rata cannot answer "what's the weather here" without being told where "here"
is. That is the intended cost of refusing IP geolocation.

## Alternatives rejected

**Passing the raw WeatherAPI payload to the agent.** It carries ~40 fields
including solar radiation figures nothing uses, and it would let a provider
change what reaches the model by changing its response shape.

**Wrapping and rethrowing the underlying network error.** Standard practice
everywhere else in this codebase, and actively unsafe here: the URL contains
the key.

**Treating the lookup as an unconfirmed read.** The data returned is public,
but the *request* reveals what place the user is asking about, and by
implication often where they are. That is the same class of disclosure
`web.search` confirms.
