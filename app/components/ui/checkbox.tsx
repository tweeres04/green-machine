import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

import { TeamColorContext } from '~/lib/teamColorContext'
import { cn } from '~/lib/utils'

const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
	const teamColor = React.useContext(TeamColorContext)

	return (
		<CheckboxPrimitive.Root
			ref={ref}
			className={cn(
				`peer h-4 w-4 shrink-0 rounded-sm border border-${teamColor}-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-${teamColor}-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-${teamColor}-900 data-[state=checked]:text-${teamColor}-50 dark:border-${teamColor}-800 dark:ring-offset-stone-950 dark:focus-visible:ring-${teamColor}-300 dark:data-[state=checked]:bg-${teamColor}-50 dark:data-[state=checked]:text-${teamColor}-900`,
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className={cn('flex items-center justify-center text-current')}
			>
				<Check className="h-4 w-4" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	)
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
