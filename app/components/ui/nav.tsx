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
	team: Team
}

export default function Nav({ title, team: { name, slug } }: Props) {
	const { pathname } = useLocation()
	const user = useContext(UserContext)

	return (
		<div className="flex items-center gap-2">
			<Avatar>
				<AvatarFallback>{name[0]}</AvatarFallback>
			</Avatar>
			<h1 className="grow text-3xl">{title ?? name}</h1>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="secondary" size="icon">
						<More />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{user ? (
						<DropdownMenuLabel>{user.name}</DropdownMenuLabel>
					) : (
						<DropdownMenuItem asChild>
							<Link to="/login">Login</Link>
						</DropdownMenuItem>
					)}
					{pathname !== `/${slug}` ? (
						<DropdownMenuItem asChild>
							<Link to={`/${slug}`}>Home</Link>
						</DropdownMenuItem>
					) : null}
					{pathname !== `/${slug}/games` ? (
						<DropdownMenuItem asChild>
							<Link to={`/${slug}/games`}>Games</Link>
						</DropdownMenuItem>
					) : null}
					{pathname !== `/${slug}/settings` ? (
						<DropdownMenuItem asChild>
							<Link to={`/${slug}/settings`}>Settings</Link>
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem asChild>
						{user ? <Link to="/logout">Logout</Link> : null}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
