import { Link } from '@remix-run/react'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { useSidebar } from '~/components/ui/sidebar'
import { Team } from '~/schema'

import { useContext } from 'react'
import { UserContext } from '~/lib/userContext'
import Burger from './icons/burger'
import X from './icons/x'

type Props = {
	title?: string
	team?: Team
}

export default function Nav({ title, team }: Props) {
	const { user } = useContext(UserContext) ?? {}
	const { open, openMobile, isMobile, toggleSidebar } = useSidebar()

	const menuIsOpen = isMobile ? openMobile : open

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
				<Button variant="secondary" size="icon" onClick={toggleSidebar}>
					{menuIsOpen ? <X /> : <Burger />}
				</Button>
			)}
		</div>
	)
}
