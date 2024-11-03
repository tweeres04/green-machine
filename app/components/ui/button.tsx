import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { TeamColorContext } from '~/lib/teamColorContext'
import { cn } from '~/lib/utils'

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const teamColor = React.useContext(TeamColorContext)

		const buttonVariants = cva(
			`w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-${teamColor}-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-stone-950 dark:focus-visible:ring-stone-300`,
			{
				variants: {
					variant: {
						default: `bg-${teamColor}-900 text-${teamColor}-50 hover:bg-${teamColor}-900/90 dark:bg-${teamColor}-50 dark:text-${teamColor}-900 dark:hover:bg-${teamColor}-50/90`,
						destructive: `bg-red-500 text-${teamColor}-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-${teamColor}-50 dark:hover:bg-red-900/90`,
						'destructive-outline':
							'border border-red-200 bg-transparent hover:bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:hover:bg-red-800 dark:hover:text-red-50',
						outline: `border border-${teamColor}-200 bg-transparent hover:bg-${teamColor}-100 hover:text-${teamColor}-900 dark:border-${teamColor}-800 dark:bg-${teamColor}-950 dark:hover:bg-${teamColor}-800 dark:hover:text-${teamColor}-50`,
						secondary: `bg-${teamColor}-100 text-${teamColor}-900 hover:bg-${teamColor}-100/80 dark:bg-${teamColor}-800 dark:text-${teamColor}-50 dark:hover:bg-${teamColor}-800/80`,
						ghost: `hover:bg-${teamColor}-100 hover:text-${teamColor}-900 dark:hover:bg-${teamColor}-800 dark:hover:text-${teamColor}-50`,
						link: `w-auto text-${teamColor}-900 underline-offset-4 hover:underline dark:text-${teamColor}-50`,
					},
					size: {
						default: 'h-10 px-4 py-2',
						sm: 'h-9 rounded-md px-3',
						lg: 'h-11 rounded-md px-8',
						icon: 'h-10 w-10 sm:w-10',
					},
				},
				defaultVariants: {
					variant: 'default',
					size: 'default',
				},
			}
		)

		const Comp = asChild ? Slot : 'button'
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		)
	}
)
Button.displayName = 'Button'

export { Button, buttonVariants }
