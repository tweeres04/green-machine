import { Link, useLocation } from '@remix-run/react'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Team } from '~/schema'

import {
	DropdownMenu,
	DropdownMenuLabel,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import More from '~/components/ui/icons/more'
import { useContext } from 'react'
import { UserContext } from '~/lib/userContext'

type Props = {
	title?: string
	team?: Team
}

export default function Nav({ title, team }: Props) {
	const { pathname } = useLocation()
	const user = useContext(UserContext)

	return (
		<div className="flex items-center gap-2">
			{team ? (
				<Avatar>
					<AvatarFallback>{team.name[0]}</AvatarFallback>
				</Avatar>
			) : null}
			<h1 className="grow text-3xl">{title ?? team?.name}</h1>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="secondary" size="icon">
						<More />
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
							{pathname !== `/${team.slug}/players` ? (
								<DropdownMenuItem asChild>
									<Link to={`/${team.slug}/players`}>Players</Link>
								</DropdownMenuItem>
							) : null}
							{pathname !== `/${team.slug}/settings` ? (
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
