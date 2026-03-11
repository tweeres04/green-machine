import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
	ActionFunction,
} from '@remix-run/node'
import { Form, useFetcher, useFetchers, useLoaderData } from '@remix-run/react'

import { getDb } from '~/lib/getDb'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import invariant from 'tiny-invariant'
import { type Team, teams } from '~/schema'
import Nav from '~/components/ui/nav'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { upperFirst } from 'lodash-es'
import { Checkbox } from '~/components/ui/checkbox'
import { eq } from 'drizzle-orm'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `Edit ${name} - TeamStats`
	const description = `Edit ${name}.`
	const url = `https://teamstats.tweeres.com/${slug}/edit`

	return [
		{ title },
		{
			name: 'description',
			content: description,
		},
		{ name: 'robots', content: 'noindex' },
		{
			tagName: 'link',
			rel: 'canonical',
			href: url,
		},
		{ name: 'og:title', content: title },
		{ name: 'og:type', content: 'website' },
		{ name: 'og:description', content: description },
		// { name: 'og:image', content: `` }, todo: add og:image
		{ name: 'og:url', content: url },
		{ tagName: 'link', rel: 'canonical', href: url },
	]
}

export async function loader({
	params: { teamSlug },
	request,
}: LoaderFunctionArgs) {
	const db = getDb()

	invariant(teamSlug, 'Missing teamSlug parameter')

	const [team, user] = await Promise.all([
		db.query.teams.findFirst({
			where: (teams, { eq }) => eq(teams.slug, teamSlug),
			with: {
				subscription: true,
			},
		}),
		authenticator.isAuthenticated(request),
	])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 401 })
	}

	return { team }
}

export const action: ActionFunction = async ({ request, params }) => {
	const db = getDb()
	const { teamSlug } = params
	invariant(teamSlug, 'Missing teamSlug parameter')

	const [team, user] = await Promise.all([
		db.query.teams.findFirst({
			where: (teams, { eq }) => eq(teams.slug, teamSlug),
		}),
		authenticator.isAuthenticated(request),
	])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 401 })
	}

	const formData = await request.formData()
	const location = formData.get('location')
	const nextGameForecast = formData.get('nextGameForecast')

	if (
		(location !== null && typeof location !== 'string') ||
		(nextGameForecast !== null && typeof nextGameForecast !== 'string')
	) {
		throw new Response('Invalid form data', { status: 400 })
	}

	await db
		.update(teams)
		.set({
			location: location || null,
			nextGameForecast:
				nextGameForecast === 'true'
					? true
					: nextGameForecast === 'false'
					? false
					: undefined,
		})
		.where(eq(teams.id, team.id))

	return null
}

function useClearNewPlayerForm(
	formRef: React.MutableRefObject<HTMLFormElement | null>
) {
	const fetchers = useFetchers()
	const isAddingPlayer = fetchers.some(
		(fetcher) =>
			fetcher.state === 'submitting' &&
			/teams\/.+\/players/.test(fetcher.formAction) &&
			fetcher.formMethod === 'POST'
	)

	useEffect(() => {
		if (!isAddingPlayer) {
			formRef.current?.reset()
		}
	}, [formRef, isAddingPlayer])
}

type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

function useImageLoadingStatus(
	src?: string,
	referrerPolicy?: React.HTMLAttributeReferrerPolicy
) {
	const [loadingStatus, setLoadingStatus] = useState<ImageLoadingStatus>('idle')

	useEffect(() => {
		if (!src) {
			setLoadingStatus('error')
			return
		}

		let isMounted = true
		const image = new window.Image()

		const updateStatus = (status: ImageLoadingStatus) => () => {
			if (!isMounted) return
			setLoadingStatus(status)
		}

		setLoadingStatus('loading')
		image.onload = updateStatus('loaded')
		image.onerror = updateStatus('error')
		image.src = src
		if (referrerPolicy) {
			image.referrerPolicy = referrerPolicy
		}

		return () => {
			isMounted = false
		}
	}, [src, referrerPolicy])

	return loadingStatus
}

function Logo({
	teamId,
	randomCacheBuster,
}: {
	teamId: number
	randomCacheBuster: number
}) {
	const imageStatus = useImageLoadingStatus(
		`https://files.tweeres.com/teamstats/teams/${teamId}/logo?${randomCacheBuster}`
	)

	return imageStatus === 'loaded' ? (
		<img
			src={`https://files.tweeres.com/teamstats/teams/${teamId}/logo?${randomCacheBuster}`}
			width="100"
			height="100"
			alt="Team logo"
		/>
	) : null
}

export default function EditTeam() {
	const [randomCacheBuster, setRandomCacheBuster] = useState(() =>
		Math.random()
	)

	const { team } = useLoaderData<typeof loader>()
	const { id, slug, color } = team
	const formRef = useRef<HTMLFormElement>(null)
	const fetcher = useFetcher()

	// Weather-specific fetcher for debounced location submission
	const weatherFetcher = useFetcher()
	const [locationValue, setLocationValue] = useState(team.location || '')
	const [nextGameForecast, setNextGameForecast] = useState(
		team.nextGameForecast ?? false
	)
	const [isSavingWeather, setIsSavingWeather] = useState(false)

	// Debounced submission when location or forecast changes
	const debouncedWeatherSubmit = useDebouncedCallback(
		(location: string, nextGameForecast: boolean) => {
			setIsSavingWeather(true)
			weatherFetcher.submit({ location, nextGameForecast }, { method: 'post' })
		},
		1000
	)

	// Auto-submit when location or forecast changes
	useEffect(() => {
		debouncedWeatherSubmit(locationValue, nextGameForecast)
	}, [debouncedWeatherSubmit, locationValue, nextGameForecast])

	// Handle weather fetcher completion
	useEffect(() => {
		if (weatherFetcher.state === 'idle' && isSavingWeather) {
			setIsSavingWeather(false)
		}
	}, [weatherFetcher.state, isSavingWeather])

	useClearNewPlayerForm(formRef)

	// Include uploading a new logo here at some point
	const submitting = fetcher.state === 'submitting'

	return (
		<>
			<Nav title="Team settings" team={team} />
			<div className="space-y-3">
				<h3 className="text-xl">Subscription status</h3>
				{team.subscription
					? upperFirst(team.subscription.subscriptionStatus)
					: 'None'}
				<h3 className="text-xl">Team Color</h3>
				<fetcher.Form
					method="post"
					action={`/teams/${id}/color`}
					className="space-y-3"
					onInput={(event) => {
						fetcher.submit(event.currentTarget)
					}}
				>
					<input type="hidden" name="slug" value={slug} />
					{/* shadcn select box at some point */}
				<select
					name="color"
					className="w-full p-2 border rounded bg-white"
					defaultValue={color}
				>
						<option value="gray">Gray</option>
						<option value="red">Red</option>
						<option value="orange">Orange</option>
						<option value="yellow">Yellow</option>
						<option value="green">Green</option>
						<option value="blue">Blue</option>
						<option value="purple">Purple</option>
						<option value="pink">Pink</option>
					</select>
				</fetcher.Form>
				<h3 className="text-xl">Weather Forecast</h3>
				<weatherFetcher.Form
					method="post"
					action={`/teams/${id}/weather`}
					className="space-y-3"
				>
					<div>
						<label htmlFor="location">Location</label>
						<Input
							type="text"
							name="location"
							id="location"
							value={locationValue}
							onChange={(e) => setLocationValue(e.target.value)}
							placeholder="e.g., San Francisco, CA"
						/>
						<p className="text-sm text-muted-foreground">
							City, state or general area where your team plays
						</p>
					</div>
					<div className="flex items-center space-x-2">
						<Checkbox
							id="nextGameForecast"
							name="nextGameForecast"
							checked={nextGameForecast}
							disabled={!locationValue}
							onCheckedChange={(checked) => {
								setNextGameForecast(checked)
							}}
						/>
						<label
							htmlFor="nextGameForecast"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Show weather forecast on next game card (requires location)
						</label>
					</div>
				</weatherFetcher.Form>
			</div>
			<fieldset
				className="space-y-3"
				disabled={submitting}
			>
				<h3 className="text-xl">Team Logo</h3>
				<Logo teamId={id} randomCacheBuster={randomCacheBuster} />
				<div className="flex flex-col sm:flex-row w-full gap-1">
					<Form
						method="post"
						action={`/teams/${id}/logo`}
						encType="multipart/form-data"
						className="flex flex-col sm:flex-row gap-1"
						reloadDocument
						onSubmit={() => {
							setRandomCacheBuster(Math.random())
							return true
						}}
					>
						<Input type="file" name="logo" accept="image/*" />
						<Button>Upload logo</Button>
					</Form>
					<fetcher.Form method="delete" action={`/teams/${id}/logo`}>
						<Button variant="destructive">Remove logo</Button>
					</fetcher.Form>
				</div>
			</fieldset>
		</>
	)
}
