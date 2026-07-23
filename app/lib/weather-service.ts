import { getDb } from './getDb'
import { WeatherForecast, weatherForecasts, teams } from '../schema'
import { subHours } from 'date-fns'
import { eq, lte, sql } from 'drizzle-orm'

export interface WeatherData {
	temperature: string
	conditions: string
	humidity?: string
	windSpeed?: string
	forecastTime: string
}

const CACHE_DURATION_HOURS = 24

function expiredDate() {
	const expiredDate = subHours(new Date(), CACHE_DURATION_HOURS)
	return expiredDate
}

// WMO weather interpretation codes -> human-readable conditions.
// https://open-meteo.com/en/docs
const weatherCodeConditions: Record<number, string> = {
	0: 'Clear sky',
	1: 'Mainly clear',
	2: 'Partly cloudy',
	3: 'Overcast',
	45: 'Fog',
	48: 'Freezing fog',
	51: 'Light drizzle',
	53: 'Drizzle',
	55: 'Heavy drizzle',
	56: 'Light freezing drizzle',
	57: 'Freezing drizzle',
	61: 'Light rain',
	63: 'Rain',
	65: 'Heavy rain',
	66: 'Light freezing rain',
	67: 'Freezing rain',
	71: 'Light snow',
	73: 'Snow',
	75: 'Heavy snow',
	77: 'Snow grains',
	80: 'Light rain showers',
	81: 'Rain showers',
	82: 'Heavy rain showers',
	85: 'Light snow showers',
	86: 'Snow showers',
	95: 'Thunderstorm',
	96: 'Thunderstorm with hail',
	99: 'Thunderstorm with heavy hail',
}

export interface GeocodeResult {
	latitude: number
	longitude: number
	countryCode: string | null
}

// Turn a free-text location into coordinates + country. Nominatim is a
// real full-text geocoder, so it handles qualifiers like "Victoria, BC"
// and street addresses (Open-Meteo's geocoder is name-prefix only).
export const geocodeLocation = async (
	location: string
): Promise<GeocodeResult | null> => {
	try {
		const geoResponse = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
				location
			)}&format=json&limit=1&addressdetails=1`,
			{ headers: { 'User-Agent': 'green-machine (team weather forecasts)' } }
		)
		const geo = await geoResponse.json()
		const place = geo?.[0]

		if (!place) {
			console.error(`Could not geocode location: ${location}`)
			return null
		}

		return {
			latitude: Number(place.lat),
			longitude: Number(place.lon),
			countryCode: place.address?.country_code ?? null,
		}
	} catch (error) {
		console.error('Error geocoding location:', error)
		return null
	}
}

const isCacheValid = (forecast: WeatherForecast) => {
	const expiresAt = expiredDate()
	const createdAt = new Date(forecast.createdAt)
	return expiresAt < createdAt
}

const getCachedForecast = async (
	gameId: number
): Promise<WeatherData | null> => {
	try {
		const db = getDb()

		const cached = await db.query.weatherForecasts.findFirst({
			where(weatherForecasts, { eq }) {
				return eq(weatherForecasts.gameId, gameId)
			},
			orderBy(weatherForecasts, { desc }) {
				return desc(weatherForecasts.createdAt)
			},
		})

		// Every 10th time or so, delete expired caches. Move to a cron at some point probably
		if (Math.random() < 0.1) {
			const expiredDate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24)
			db.delete(weatherForecasts)
				.where(
					lte(
						sql`datetime(${weatherForecasts.createdAt})`,
						sql`datetime(${expiredDate})`
					)
				)
				.execute()
				.then((result) => {
					console.log('Cache cleanup result', result)
				})
		}

		if (cached && isCacheValid(cached)) {
			return JSON.parse(cached.forecastData)
		}

		return null
	} catch (error) {
		console.error('Error checking cached forecast:', error)
		return null
	}
}

const cacheForecast = async (weatherData: WeatherData, gameId: number) => {
	try {
		const db = getDb()
		const now = new Date()

		await db.insert(weatherForecasts).values({
			gameId,
			forecastData: JSON.stringify(weatherData),
			createdAt: now.toISOString(),
		})
	} catch (error) {
		console.error('Error caching forecast:', error)
	}
}

export const getGameForecast = async (gameId: number) => {
	// Temporary timing logs to find where the 5s streaming budget goes in prod
	const start = Date.now()
	const mark = (label: string) => {
		console.log(
			`weather timing [game ${gameId}] ${label}: ${
				Date.now() - start
			}ms (${new Date().toISOString()})`
		)
	}
	mark('start')
	try {
		const cachedForecast = await getCachedForecast(gameId)
		mark('cache checked')
		if (cachedForecast) {
			return cachedForecast
		}

		const db = getDb()

		const game = await db.query.games.findFirst({
			where(games, { eq }) {
				return eq(games.id, gameId)
			},
			with: {
				team: true,
			},
		})

		mark('game loaded')

		if (!game) {
			console.error(`Game not found: ${gameId}`)
			return null
		}

		if (!game.timestamp) {
			console.error(`No timestamp on game`)
			return null
		}

		if (!game.team.location) {
			console.error(`No location on team`)
			return null
		}

		// Coordinates are geocoded and stored when the location is saved in
		// settings. Teams saved before that existed get geocoded here once,
		// then read from the team row like everyone else.
		let coords: GeocodeResult
		if (game.team.latitude != null && game.team.longitude != null) {
			coords = {
				latitude: game.team.latitude,
				longitude: game.team.longitude,
				countryCode: game.team.countryCode,
			}
		} else {
			const geocoded = await geocodeLocation(game.team.location)

			if (!geocoded) {
				return null
			}

			coords = geocoded

			await db.update(teams).set(geocoded).where(eq(teams.id, game.team.id))
		}

		// US is the practical exception that wants Fahrenheit/mph; everywhere
		// else (including Canada) gets metric. Nominatim returns a lowercase code.
		const useImperial = coords.countryCode === 'us'
		const temperatureUnit = useImperial ? 'fahrenheit' : 'celsius'
		const windSpeedUnit = useImperial ? 'mph' : 'kmh'

		// Forecast in UTC (timezone=GMT) so hourly times line up with the
		// game's UTC timestamp without offset math.
		mark('forecast fetch start')
		const forecastResponse = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=${temperatureUnit}&wind_speed_unit=${windSpeedUnit}&timezone=GMT&forecast_days=16`
		)
		mark('forecast response received')
		const forecast = await forecastResponse.json()
		mark('forecast body parsed')
		const hourly = forecast.hourly

		if (!hourly?.time?.length) {
			console.error(`No hourly forecast returned for ${game.team.location}`)
			return null
		}

		// Find the forecast hour closest to game time.
		const gameTime = new Date(game.timestamp).getTime()
		let closestIndex = 0
		let closestDiff = Infinity
		hourly.time.forEach((time: string, index: number) => {
			const diff = Math.abs(new Date(`${time}Z`).getTime() - gameTime)
			if (diff < closestDiff) {
				closestDiff = diff
				closestIndex = index
			}
		})

		// If the nearest hour is more than 6 hours off, the game is outside the
		// forecast window (~16 days out) and we have no real data for it.
		if (closestDiff > 6 * 60 * 60 * 1000) {
			console.error(`Game time outside forecast window: ${game.timestamp}`)
			return null
		}

		const temperature = hourly.temperature_2m[closestIndex]
		const humidity = hourly.relative_humidity_2m[closestIndex]
		const windSpeed = hourly.wind_speed_10m[closestIndex]
		const weatherCode = hourly.weather_code[closestIndex]
		const units = forecast.hourly_units

		const weatherData: WeatherData = {
			temperature: `${Math.round(temperature)}${units.temperature_2m}`,
			conditions: weatherCodeConditions[weatherCode] ?? 'Unknown',
			humidity:
				humidity != null ? `${Math.round(humidity)}${units.relative_humidity_2m}` : undefined,
			windSpeed:
				windSpeed != null
					? `${Math.round(windSpeed)} ${units.wind_speed_10m}`
					: undefined,
			forecastTime: `${hourly.time[closestIndex]}Z`,
		}

		mark('done')

		cacheForecast(weatherData, gameId).then(() => {
			console.log(`cached weather data for ${gameId}`)
		})

		return weatherData
	} catch (error) {
		console.error('Error fetching weather forecast:', error)
		return null
	}
}
