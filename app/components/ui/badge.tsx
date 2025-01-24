import * as React from 'react'
import { useContext } from 'react'
import { TeamColorContext } from '~/lib/teamColorContext'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	const teamColor = useContext(TeamColorContext)
	const badgeVariants = cva(
		`inline-flex items-center rounded-full border border-${teamColor}-200 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-${teamColor}-950 focus:ring-offset-2 dark:border-${teamColor}-800 dark:focus:ring-${teamColor}-300`,
		{
			variants: {
				variant: {
					default: `border-transparent bg-${teamColor}-900 text-${teamColor}-50 hover:bg-${teamColor}-900/80 dark:bg-${teamColor}-50 dark:text-${teamColor}-900 dark:hover:bg-${teamColor}-50/80`,
					secondary: `border-transparent bg-${teamColor}-100 text-${teamColor}-900 hover:bg-${teamColor}-100/80 dark:bg-${teamColor}-800 dark:text-${teamColor}-50 dark:hover:bg-${teamColor}-800/80`,
					destructive:
						'border-transparent bg-red-500 text-stone-50 hover:bg-red-500/80 dark:bg-red-900 dark:text-stone-50 dark:hover:bg-red-900/80',
					outline: `text-${teamColor}-950 dark:text-${teamColor}-50`,
				},
			},
			defaultVariants: {
				variant: 'default',
			},
		}
	)

	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	)
}

export { Badge }
