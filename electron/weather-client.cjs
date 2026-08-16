'use strict'

const DEFAULT_ENDPOINT = 'https://api.weatherapi.com/v1/current.json'
const MAX_QUERY_LENGTH = 100
const MAX_TEXT_LENGTH = 120

/**
 * WeatherAPI.com current-conditions client.
 *
 * Same shape as electron/serper-client.cjs: the credential is captured in this
 * closure and never leaves it. The tool layer receives a bound
 * `getCurrentWeather(query)` capability, not the key, so a module discovered
 * from electron/tools/ can ask for weather but cannot read or exfiltrate the
 * credential.
 *
 * One difference from Serper matters and drives the error handling below.
 * Serper takes its key in a request header. WeatherAPI accepts it **only as a
 * `key=` query parameter**, so the request URL is itself a secret. Nothing here
 * may log, return or embed the URL — not in an error, not in an audit event.
 * Every failure below is reported as a fixed string for that reason.
 */

/** Third-party text. Clamp, stringify and strip control characters. */
function text(value, limit = MAX_TEXT_LENGTH) {
  return String(value == null ? '' : value)
    // eslint-disable-next-line no-control-regex -- stripping control bytes is the point
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, limit)
}

function finiteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Accepted location forms: place names, postcodes and `lat,lon`.
 *
 * The provider also understands `auto:ip`, `iata:` and `id:` prefixes. Those
 * are refused in this version: `auto:ip` silently geolocates the user from
 * their IP address, which is a different privacy decision from looking up a
 * place the user named, and it should be an explicit product choice rather
 * than a side effect of a permissive validator.
 */
function validateQuery(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('A location is required.')
  }
  const query = input.trim()
  if (query.length > MAX_QUERY_LENGTH) {
    throw new TypeError(`A location must be ${MAX_QUERY_LENGTH} characters or fewer.`)
  }
  // eslint-disable-next-line no-control-regex -- refusing control bytes is the point
  if (/[\u0000-\u001f\u007f]/.test(query)) {
    throw new TypeError('That location is not valid.')
  }
  if (/^(auto|iata|id|ip|metar)\s*:/i.test(query)) {
    throw new TypeError('Only place names, postcodes and coordinates are supported.')
  }
  if (!/^[\p{L}\p{N} .,'()’/-]+$/u.test(query)) {
    throw new TypeError('That location contains unsupported characters.')
  }
  return query
}

/** Maps the provider payload onto a fixed shape. The raw body never escapes. */
function shapeCurrentWeather(body) {
  const location = body?.location
  const current = body?.current
  if (!location || !current) throw new Error('Weather lookup returned an unexpected response.')

  const air = current.air_quality || {}
  return {
    location: {
      name: text(location.name),
      region: text(location.region),
      country: text(location.country),
      localtime: text(location.localtime, 40)
    },
    current: {
      tempC: finiteNumber(current.temp_c),
      tempF: finiteNumber(current.temp_f),
      feelsLikeC: finiteNumber(current.feelslike_c),
      feelsLikeF: finiteNumber(current.feelslike_f),
      condition: text(current.condition?.text),
      humidity: finiteNumber(current.humidity),
      windKph: finiteNumber(current.wind_kph),
      windDir: text(current.wind_dir, 8),
      precipMm: finiteNumber(current.precip_mm),
      cloud: finiteNumber(current.cloud),
      uv: finiteNumber(current.uv),
      isDay: current.is_day === 1,
      lastUpdated: text(current.last_updated, 40)
    },
    airQuality: {
      // WeatherAPI returns these only when aqi=yes was requested.
      usEpaIndex: finiteNumber(air['us-epa-index']),
      gbDefraIndex: finiteNumber(air['gb-defra-index']),
      pm2_5: finiteNumber(air.pm2_5),
      pm10: finiteNumber(air.pm10)
    },
    // Third-party text (notably `condition`) reaches a provider only fenced,
    // exactly like web.fetch content. See ADR-011.
    trust: 'untrusted-external'
  }
}

function createWeatherClient({
  apiKey,
  fetchImpl = globalThis.fetch,
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = 15000,
  includeAirQuality = true
} = {}) {
  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0

  async function getCurrentWeather(input) {
    const query = validateQuery(input)
    // Unconfigured fails here, at execution, rather than at registration, so
    // the UI can explain why weather is unavailable instead of the whole
    // registry failing to build.
    if (!configured) {
      throw new Error('Weather is not configured. Set WEATHER_API_KEY in .env.local.')
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('No fetch implementation is available for weather.')
    }

    const url = new URL(endpoint)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('q', query)
    url.searchParams.set('aqi', includeAirQuality ? 'yes' : 'no')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal
      })
    } catch (error) {
      // Never echo the caught error: it can carry the request URL, and this
      // URL contains the API key.
      // eslint-disable-next-line preserve-caught-error -- the URL carries the credential
      throw new Error(error?.name === 'AbortError' ? 'Weather lookup timed out.' : 'Weather lookup failed.')
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 400) {
      // WeatherAPI uses 400 for "no matching location", which is a normal
      // outcome rather than a failure of the integration.
      throw new Error(`No weather location matched “${query}”.`)
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('The weather API key was rejected.')
    }
    if (!response.ok) {
      throw new Error(`Weather lookup returned HTTP ${response.status}.`)
    }

    let body
    try {
      body = await response.json()
    } catch {
      throw new Error('Weather lookup returned unreadable JSON.')
    }
    return shapeCurrentWeather(body)
  }

  return getCurrentWeather
}

module.exports = {
  createWeatherClient,
  validateQuery,
  shapeCurrentWeather,
  DEFAULT_ENDPOINT,
  MAX_QUERY_LENGTH
}
