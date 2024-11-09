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

type Props = {
	title?: string
	team?: Team
}

export default function Nav({ title, team }: Props) {
	const { pathname } = useLocation()
	const { user, userHasAccessToTeam } = useContext(UserContext) ?? {}

	const [menuIsOpen, setMenuIsOpen] = useState(false)

	return (
		<div className="flex items-center gap-2">
			{team ? (
				<Avatar>
					<AvatarImage
						src={`https://files.tweeres.com/teamstats/teams/${team.id}/logo`}
					></AvatarImage>
					<AvatarFallback>{team.name[0]}</AvatarFallback>
				</Avatar>
			) : null}
			<h1 className="grow text-3xl">{title ?? team?.name}</h1>

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
							{userHasAccessToTeam && pathname !== `/${team.slug}/settings` ? (
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
								{user ? <Link to="/logout">Logout</Link> : null}
							</DropdownMenuItem>
						</>
					) : (
						<DropdownMenuItem asChild>
							<Link to="/login">Login</Link>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
