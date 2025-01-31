import type { ComponentProps } from 'react'
import Nav from '~/components/ui/nav'
import { Button } from '~/components/ui/button'
import { Link } from '@remix-run/react'

type HomeLandingPageProps = ComponentProps<typeof HomeLandingPage>

function Cta({ teamCount, statCount }: HomeLandingPageProps) {
	return (
		<div className="text-center space-y-3 py-6">
			<div className="flex justify-center">
				<Button size="lg" asChild>
					<Link to="/teams/new" className="w-full">
						Start tracking
					</Link>
				</Button>
			</div>
			<small className="block text-sm leading-none">
				Join <strong>{teamCount}</strong> teams tracking{' '}
				<strong>{statCount}</strong> stats
			</small>
		</div>
	)
}

export default function HomeLandingPage({
	teamCount,
	statCount,
}: {
	teamCount: number
	statCount: number
}) {
	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<Nav title="TeamStats" />
			<div className="hero space-y-3">
				<h2 className="text-3xl">
					Track your soccer team's stats. Straightforward and affordable.
				</h2>
				<p>
					TeamStats is a small, focused soccer team stat tracking app. Built by
					one person who loves soccer.
				</p>
			</div>
			<Cta {...{ teamCount, statCount }} />
			<blockquote className="border-l-2 pl-6 italic relative pt-10">
				<span className="text-[96px] block absolute -top-5 left-3">“</span>
				It's so fun to enter in the stats after a game. We love following the
				story of the season.{' '}
				<Button variant="link" asChild className="px-0 py-0 h-auto">
					<a href="https://teamstats.tweeres.com/green-machine">
						- Green Machine
					</a>
				</Button>
			</blockquote>
			<div className="features space-y-10">
				<h3 className="text-2xl">Why TeamStats?</h3>
				<ul className="space-y-7 [&_li]:space-y-3">
					<li>
						<h4 className="text-xl">Easy to use</h4>
						<p>
							Track your team's stats with a few clicks or taps. Import your
							schedule from your league website using AI.
						</p>
					</li>
					<li>
						<h4 className="text-xl">Beautiful stat visualizations</h4>
						<p>
							Quickly see your team's performance over time. See who's winning
							the golden boot race. Track goal or assist streaks.
						</p>
					</li>
					<li>
						<h4 className="text-xl">Shareable stat leaderboards</h4>
						<p>
							Quickly share the golden boot or assist race in the team group
							chat.
						</p>
					</li>
				</ul>
				<ul className="space-y-7 [&_li]:space-y-3">
					<li>
						<h4 className="text-xl">Affordable</h4>
						<p>Only $19 USD per year. I'm a one person team with low costs.</p>
					</li>
					<li>
						<h4 className="text-xl">Works everywhere</h4>
						<p>
							Easily installable on any device — phone, computer, tablet.
							Anything with a web browser.
						</p>
					</li>
					<li>
						<h4 className="text-xl">Small and focused</h4>
						<p>
							Other apps need to keep building to satisfy investors and keep
							busy. I'm building just the features we need, and that's it.
						</p>
					</li>
				</ul>
				<ul className="space-y-7 [&_li]:space-y-3">
					<li>
						<h4 className="text-xl">Expert team</h4>
						<p>
							I've been designing and building software professionally for over
							15 years. I create new features quickly and thoughtfully. I ship
							way fewer bugs than the rest.
						</p>
					</li>
				</ul>
			</div>
			<Cta {...{ teamCount, statCount }} />
			<footer className="py-16">
				<Button variant="link" className="p-0">
					<a href="https://tweeres.ca/about">By Tyler Weeres</a>
				</Button>
			</footer>
		</div>
	)
}
