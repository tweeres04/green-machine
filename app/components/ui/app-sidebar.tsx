import { Link, useLocation } from '@remix-run/react'
import { useContext } from 'react'
import {
	CalendarDays,
	CalendarRange,
	CreditCard,
	House,
	LogIn,
	LogOut,
	Settings,
	Users,
} from 'lucide-react'
import mixpanel from 'mixpanel-browser'

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '~/components/ui/sidebar'
import { UserContext } from '~/lib/userContext'

type SidebarTeam = { id: number; name: string; slug: string }

export function AppSidebar({
	team,
	userTeams,
}: {
	team: SidebarTeam | null
	userTeams: SidebarTeam[]
}) {
	const { pathname, search } = useLocation()
	const { user, userHasAccessToTeam } = useContext(UserContext) ?? {}
	const { setOpen, setOpenMobile } = useSidebar()

	// Keeps demo visitors in demo mode as they explore, so the demo cta bar
	// doesn't vanish on their first navigation
	const demoSuffix = new URLSearchParams(search).get('demo') ? '?demo=1' : ''

	function closeSidebar() {
		setOpen(false)
		setOpenMobile(false)
	}

	const teamLinks = team
		? [
				{
					label: 'Home',
					to: `/${team.slug}${demoSuffix}`,
					path: `/${team.slug}`,
					icon: House,
					show: true,
				},
				{
					label: 'Games',
					to: `/${team.slug}/games${demoSuffix}`,
					path: `/${team.slug}/games`,
					icon: CalendarDays,
					show: true,
				},
				{
					label: 'Players',
					to: `/${team.slug}/players`,
					path: `/${team.slug}/players`,
					icon: Users,
					show: userHasAccessToTeam,
				},
				{
					label: 'Seasons',
					to: `/${team.slug}/seasons`,
					path: `/${team.slug}/seasons`,
					icon: CalendarRange,
					show: userHasAccessToTeam,
				},
				{
					label: 'Settings',
					to: `/${team.slug}/settings`,
					path: `/${team.slug}/settings`,
					icon: Settings,
					show: userHasAccessToTeam,
				},
		  ].filter((l) => l.show)
		: []

	return (
		<Sidebar side="right">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild onClick={closeSidebar}>
							<Link to="/">
								<img
									src="/teamstats-logo.svg"
									alt=""
									className="size-5"
								/>
								<span className="font-semibold">TeamStats</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{team ? (
					<SidebarGroup>
						<SidebarGroupLabel>{team.name}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{teamLinks.map((l) => (
									<SidebarMenuItem key={l.label}>
										<SidebarMenuButton
											asChild
											isActive={pathname === l.path}
											onClick={closeSidebar}
										>
											<Link to={l.to}>
												<l.icon />
												{l.label}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
				{user && userTeams.length > 0 ? (
					<SidebarGroup>
						<SidebarGroupLabel>Your teams</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{userTeams.map((t) => (
									<SidebarMenuItem key={t.id}>
										<SidebarMenuButton
											asChild
											isActive={t.slug === team?.slug}
											onClick={closeSidebar}
										>
											<Link to={`/${t.slug}`}>
												<Avatar className="size-4">
													<AvatarImage
														src={`https://files.tweeres.com/teamstats/teams/${t.id}/logo`}
													/>
													<AvatarFallback className="text-[10px]">
														{t.name[0]}
													</AvatarFallback>
												</Avatar>
												{t.name}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter>
				{user ? <SidebarGroupLabel>{user.name}</SidebarGroupLabel> : null}
				<SidebarMenu>
					{user ? (
						<>
							{pathname !== '/' ? (
								<SidebarMenuItem>
									<SidebarMenuButton asChild onClick={closeSidebar}>
										<Link to="/">
											<House />
											Home
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : null}
							{user.stripeCustomerId ? (
								<SidebarMenuItem>
									<SidebarMenuButton asChild onClick={closeSidebar}>
										<Link to="/manage-billing">
											<CreditCard />
											Manage billing
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : null}
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									onClick={() => {
										mixpanel.reset()
										closeSidebar()
									}}
								>
									<Link to="/logout">
										<LogOut />
										Logout
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</>
					) : (
						<SidebarMenuItem>
							<SidebarMenuButton asChild onClick={closeSidebar}>
								<Link to="/login">
									<LogIn />
									Login
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					)}
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	)
}
