import { GoogleGenAI } from '@google/genai'
import { getDb } from './getDb'
import { WeatherForecast, weatherForecasts } from '../schema'
import { subHours } from 'date-fns'
import { lte, sql } from 'drizzle-orm'

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

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

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
	try {
		const cachedForecast = await getCachedForecast(gameId)
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

		if (!game) {
			console.error(`Game not found: ${gameId}`)
			return null
		}

		if (!game.timestamp) {
			console.error(`No timestamp on game`)
			return null
		}

		const prompt = `What is the weather forecast for ${game.team.location} specifically around ${game.timestamp}? Please use current weather data and forecasting information to provide:
1. Temperature
2. Weather conditions (sunny, cloudy, rainy, etc.)
3. Wind speed if available

For data points that require a unit (temperature, wind speed), use appropriate local units for ${game.team.location}.

Only respond with json, do not include any other text. Use the following JSON format:
{
  "temperature": "22°C",
  "conditions": "Partly cloudy",
  "windSpeed": "10 km/h",
}`

		const result = await ai.models.generateContent({
			model: 'gemini-2.5-flash-lite',
			contents: prompt,
			config: { tools: [{ googleSearch: {} }] },
		})

		const weatherData: WeatherData = result.text
			? JSON.parse(result.text.replace(/^```json/, '').replace(/```$/, ''))
			: null

		const badValues = ['N/A', 'unknown']
		weatherData.windSpeed =
			weatherData.windSpeed && badValues.includes(weatherData.windSpeed)
				? undefined
				: weatherData.windSpeed

		cacheForecast(weatherData, gameId).then(() => {
			console.log(`cached weather data for ${gameId}`)
		})

		return weatherData
	} catch (error) {
		console.error('Error fetching weather forecast:', error)
		return null
	}
}
