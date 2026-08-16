const { MAX_QUERY_LENGTH } = require('../weather-client.cjs')

/**
 * The `weather.` domain (RATA-007).
 *
 * `weatherCurrent` is a bound capability, never the credential — the key stays
 * inside the closure built in electron/weather-client.cjs. Absence is a
 * legitimate state (the user may have no WeatherAPI key), so the tool registers
 * and fails at execute rather than aborting composition.
 */
function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

function formatReport(weather) {
  const { location, current, airQuality } = weather
  const place = [location.name, location.region, location.country].filter(Boolean).join(', ')
  const lines = [
    `${place} — ${current.condition || 'conditions unavailable'}`,
    `${current.tempC}°C (feels like ${current.feelsLikeC}°C), humidity ${current.humidity}%, wind ${current.windKph} kph ${current.windDir}`.trim()
  ]
  if (Number.isFinite(airQuality.usEpaIndex)) {
    const scale = ['', 'good', 'moderate', 'unhealthy for sensitive groups', 'unhealthy', 'very unhealthy', 'hazardous']
    lines.push(`Air quality: ${scale[airQuality.usEpaIndex] || 'unknown'} (US EPA index ${airQuality.usEpaIndex})`)
  }
  lines.push(`Observed ${current.lastUpdated} local time.`)
  return lines.join('\n')
}

function create({ weatherCurrent } = {}) {
  const lookup =
    typeof weatherCurrent === 'function'
      ? weatherCurrent
      : async () => {
          throw new Error('Weather is not configured. Set WEATHER_API_KEY in .env.local.')
        }

  return [{
    id: 'weather.current',
    description: 'Look up current weather and air quality for a named place.',
    // A lookup reads public data, but the location the user asks about leaves
    // the machine and reaches a third party, so it is confirmable in exactly
    // the same way web.search is. See ADR-011.
    risk: 'read',
    confirmation: 'configurable',
    confirmationSetting: 'weatherConfirm',
    validateInput: input => {
      const value = requireObject(input, 'weather.current')
      if (typeof value.query !== 'string' || !value.query.trim()) {
        throw new TypeError('weather.current requires a location.')
      }
      if (value.query.length > MAX_QUERY_LENGTH) {
        throw new TypeError(`A location must be ${MAX_QUERY_LENGTH} characters or fewer.`)
      }
      return { query: value.query.trim() }
    },
    describeInput: input =>
      `Look up the current weather for “${String(input.query).slice(0, 100)}”. The location is sent to WeatherAPI.com.`,
    execute: async ({ query }) => {
      const weather = await lookup(query)
      return {
        ...weather,
        summary: `Weather for ${weather.location.name}`,
        message: formatReport(weather)
      }
    }
  }]
}

module.exports = { id: 'weather', toolIds: ['weather.current'], create, formatReport }
