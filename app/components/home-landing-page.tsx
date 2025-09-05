import Nav from '~/components/ui/nav'
import { Button } from '~/components/ui/button'
import { Link } from '@remix-run/react'
import {
	CalendarCheck,
	ChartScatter,
	Focus,
	Hammer,
	MonitorSmartphone,
	Share,
	Wallet,
	WandSparkles,
} from 'lucide-react'
import React from 'react'
import { Instagram } from '~/components/ui/icons/instagram'
import { TikTok } from '~/components/ui/icons/tiktok'
import { Youtube } from '~/components/ui/icons/youtube'

function Cta() {
	return (
		<div className="text-center space-y-3 py-6">
			<div className="flex justify-center">
				<Button
					size="lg"
					asChild
					className="transition-all ease-linear hover:shadow-xl hover:scale-105 hover:bg-gray-800"
				>
					<Link to="/teams/new" className="w-full">
						Set up your team in 2 minutes
					</Link>
				</Button>
			</div>
			<small className="block text-sm leading-none font-light">
				Just $19 USD/year for your whole team
			</small>
		</div>
	)
}

function FeatureList({ children }: { children: React.ReactNode }) {
	return <ul className="space-y-7 [&_li]:space-y-3">{children}</ul>
}

function FeatureListItem({
	icon,
	title,
	children,
}: {
	icon: JSX.Element
	title: string
	children: React.ReactNode
}) {
	return (
		<li>
			<h4 className="text-xl flex items-center gap-3">
				{React.cloneElement(icon, { className: 'size-7' })} {title}
			</h4>
			{children}
		</li>
	)
}

export default function HomeLandingPage() {
	return (
		<>
			<Nav title="TeamStats" />
			<div className="space-y-20">
				<div className="hero space-y-8">
					<div className="space-y-3">
						<h2 className="text-3xl">Make every game more fun</h2>
						<p>
							Give your social soccer team something to celebrate — track goals
							and assists, see who's playing next, and build team spirit
						</p>
					</div>
					<Cta />
					<img
						src="/leaderboard.webp"
						srcSet="/leaderboard-400.webp 400w, /leaderboard-800.webp 800w, /leaderboard.webp 1170w"
						sizes="(max-width: 600px) 100vw, 800px"
						alt="A screenshot of the TeamStats leaderboard for the team Green Machine. The leader has 14 goals and 1 assist."
						loading="lazy"
						className="shadow-lg border-2 border-gray-100 rounded-xl p-1 mx-auto sm:w-2/3"
					/>
					<img
						src="/next-game.webp"
						srcSet="/next-game-400.webp 400w, /next-game-800.webp 800w, /next-game.webp 1170w"
						sizes="(max-width: 600px) 100vw, 800px"
						alt="A screenshot of the TeamStats next game schedule for the team Green Machine."
						loading="lazy"
						className="shadow-lg border-2 border-gray-100 rounded-xl p-1 mx-auto sm:w-2/3"
					/>
					<blockquote className="border-l-8 pl-4 italic relative pt-10">
						<span className="text-[96px] block absolute -top-5 left-3">“</span>
						It's so fun to enter in the stats after a game. We love following
						the golden boot race over the season.{' '}
						<span className="whitespace-nowrap">
							-{' '}
							<Button
								variant="link"
								asChild
								className="px-0 py-0 h-auto underline"
							>
								<a href="https://teamstats.tweeres.com/green-machine">
									Green Machine
								</a>
							</Button>
						</span>
					</blockquote>
					<blockquote className="border-l-8 pl-4 italic relative pt-10">
						<span className="text-[96px] block absolute -top-5 left-3">“</span>
						TeamStats is SICK. It's a dopamine hit to look at your stats.{' '}
						<span className="whitespace-nowrap">- Lucas W., on two teams</span>
					</blockquote>
					<blockquote className="border-l-8 pl-4 italic relative pt-10">
						<span className="text-[96px] block absolute -top-5 left-3">“</span>I
						just randomly go to it sometimes and look at stats{' '}
						<span className="whitespace-nowrap">- Jeremy W., on two teams</span>
					</blockquote>
				</div>
				<Cta />
				<div className="features space-y-10">
					<h3 className="text-2xl">Why TeamStats?</h3>
					<FeatureList>
						<FeatureListItem
							icon={<ChartScatter />}
							title="Beautiful stat visualizations"
						>
							<p>
								Quickly see your team's performance over time. See who's winning
								the golden boot race. Track goal or assist streaks.
							</p>
						</FeatureListItem>
						<FeatureListItem
							icon={<Share />}
							title="Shareable stat leaderboards"
						>
							<p>
								Quickly share the golden boot or assist race in the team group
								chat.
							</p>
						</FeatureListItem>
						<FeatureListItem icon={<CalendarCheck />} title="Never miss a game">
							<p>
								See your full season schedule, track who's playing, and import
								games from your league website.
							</p>
						</FeatureListItem>
						<FeatureListItem icon={<WandSparkles />} title="Easy to use">
							<p>
								Track your team's stats with a few clicks or taps. Import your
								schedule from your league website.
							</p>
						</FeatureListItem>
					</FeatureList>
					<Cta />
					<FeatureList>
						<FeatureListItem icon={<Focus />} title="Small and focused">
							<p>
								Other apps need to keep building to satisfy investors and keep
								busy. I'm building just the features we need, and that's it.
							</p>
						</FeatureListItem>
						<FeatureListItem icon={<Wallet />} title="Affordable">
							<p>
								Only $19 USD per year. I'm a one person team with low costs.
							</p>
						</FeatureListItem>
						<FeatureListItem icon={<Hammer />} title="Expert team">
							<p>
								I've been designing and building software professionally for
								over 15 years. I create new features quickly and thoughtfully. I
								ship way fewer bugs than the rest.
							</p>
						</FeatureListItem>
						<FeatureListItem
							icon={<MonitorSmartphone />}
							title="Works everywhere"
						>
							<p>
								Easily installable on any device. Phone, computer, tablet.
								Anything with a web browser.
							</p>
						</FeatureListItem>
					</FeatureList>
				</div>
				<Cta />
				<footer className="py-16 space-y-5">
					<div>
						<Button variant="link" className="p-0" asChild>
							<Link to="https://tweeres.ca/about">
								By Tyler Weeres ©{new Date().getFullYear()}
							</Link>
						</Button>
					</div>
					<div>
						<Button variant="link" className="p-0 underline" asChild>
							<Link to="/privacy-policy">Privacy policy</Link>
						</Button>{' '}
						·{' '}
						<Button variant="link" className="p-0 underline" asChild>
							<Link to="/terms-of-service">Terms of Service</Link>
						</Button>{' '}
						·{' '}
						<Button variant="link" className="p-0 underline" asChild>
							<Link to="/contact">Contact</Link>
						</Button>
					</div>
					<div className="space-x-2">
						<Button variant="ghost" size="icon" className="size-6" asChild>
							<Link
								to="https://www.instagram.com/teamstats.app"
								aria-label="Instagram"
							>
								<Instagram />
							</Link>
						</Button>{' '}
						<Button variant="ghost" size="icon" className="size-6" asChild>
							<Link
								to="https://www.tiktok.com/@teamstats.app"
								aria-label="TikTok"
							>
								<TikTok />
							</Link>
						</Button>
						<Button variant="ghost" size="icon" className="size-6" asChild>
							<Link
								to="https://www.youtube.com/@teamstatsapp"
								aria-label="Youtube"
							>
								<Youtube />
							</Link>
						</Button>
					</div>
				</footer>
			</div>
		</>
	)
}
