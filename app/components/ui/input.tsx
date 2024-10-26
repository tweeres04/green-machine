import { cva } from 'class-variance-authority'
import * as React from 'react'
import { TeamColorContext } from '~/lib/teamColorContext'

import { cn } from '~/lib/utils'

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, variant, type, ...props }, ref) => {
		const teamColor = React.useContext(TeamColorContext)
		const inputVariants = cva(
			'flex h-10 w-full text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:ring-offset-stone-950 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-300',
			{
				variants: {
					variant: {
						default: `rounded-md border border-stone-200 bg-white px-3 py-2 focus-visible:ring-offset-2`,
						transparent: `bg-${teamColor}-50 border-0 px-1`,
					},
				},
				defaultVariants: {
					variant: 'default',
				},
			}
		)

		return (
			<input
				type={type}
				className={cn(inputVariants({ variant, className }))}
				ref={ref}
				{...props}
			/>
		)
	}
)
Input.displayName = 'Input'

export { Input }
