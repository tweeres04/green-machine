import { Link, useLocation } from '@remix-run/react'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Team } from '~/schema'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import More from '~/components/ui/icons/more'

type Props = {
	title?: string
	team: Team
}

export default function Nav({ title, team: { name, slug } }: Props) {
	const { pathname } = useLocation()

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
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
