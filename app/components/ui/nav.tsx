import { Link, useLocation } from '@remix-run/react'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Team } from '~/schema'

import {
	DropdownMenu,
	DropdownMenuLabel,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { useContext, useState } from 'react'
import { UserContext } from '~/lib/userContext'
import Burger from './icons/burger'
import X from './icons/x'
import mixpanel from 'mixpanel-browser'

type Props = {
	title?: string
	team?: Team
}

export default function Nav({ title, team }: Props) {
	const { pathname } = useLocation()
	const { user, userHasAccessToTeam } = useContext(UserContext) ?? {}

	const [menuIsOpen, setMenuIsOpen] = useState(false)

	return (
		<div
			className={`flex items-center gap-2 border-b border-${
				team?.color ?? 'gray'
			}-200 -mx-2 -mt-2 p-2`}
		>
			{team ? (
				<Avatar>
					<AvatarImage
						src={`https://files.tweeres.com/teamstats/teams/${team.id}/logo`}
					></AvatarImage>
					<AvatarFallback>{team.name[0]}</AvatarFallback>
				</Avatar>
			) : null}
			<h1 className="grow text-2xl">{title ?? team?.name}</h1>

			{!user && !team ? (
				<Link to="/login">
					<Button variant="secondary">Sign in</Button>
				</Link>
			) : (
				<DropdownMenu open={menuIsOpen} onOpenChange={setMenuIsOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="secondary" size="icon">
							{menuIsOpen ? <X /> : <Burger />}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="[&_a[role=menuitem]]:cursor-pointer">
						{team ? (
							<>
								<DropdownMenuLabel>{team.name}</DropdownMenuLabel>
								{pathname !== `/${team.slug}` ? (
									<DropdownMenuItem asChild>
										<Link to={`/${team.slug}`}>Stats</Link>
									</DropdownMenuItem>
								) : null}
								{pathname !== `/${team.slug}/games` ? (
									<DropdownMenuItem asChild>
										<Link to={`/${team.slug}/games`}>Games</Link>
									</DropdownMenuItem>
								) : null}
								{userHasAccessToTeam && pathname !== `/${team.slug}/players` ? (
									<DropdownMenuItem asChild>
										<Link to={`/${team.slug}/players`}>Players</Link>
									</DropdownMenuItem>
								) : null}
								{userHasAccessToTeam && pathname !== `/${team.slug}/seasons` ? (
									<DropdownMenuItem asChild>
										<Link to={`/${team.slug}/seasons`}>Seasons</Link>
									</DropdownMenuItem>
								) : null}
								{userHasAccessToTeam &&
								pathname !== `/${team.slug}/settings` ? (
									<DropdownMenuItem asChild>
										<Link to={`/${team.slug}/settings`}>Settings</Link>
									</DropdownMenuItem>
								) : null}
							</>
						) : null}
						{user ? (
							<>
								<DropdownMenuLabel>{user.name}</DropdownMenuLabel>
								{pathname !== '/' ? (
									<DropdownMenuItem asChild>
										<a href="/">Teams</a>
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem asChild>
									{user?.stripeCustomerId ? (
										<Link to="/manage-billing">Manage billing</Link>
									) : null}
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									{user ? (
										<Link
											to="/logout"
											onClick={() => {
												mixpanel.reset()
											}}
										>
											Logout
										</Link>
									) : null}
								</DropdownMenuItem>
							</>
						) : (
							<DropdownMenuItem asChild>
								<Link to="/login">Login</Link>
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	)
}
