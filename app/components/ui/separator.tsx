import * as React from 'react'
import { useContext } from 'react'
import { TeamColorContext } from '~/lib/teamColorContext'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '~/lib/utils'

const Separator = React.forwardRef<
	React.ElementRef<typeof SeparatorPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
	(
		{ className, orientation = 'horizontal', decorative = true, ...props },
		ref
	) => {
		const teamColor = useContext(TeamColorContext)
		return (
			<SeparatorPrimitive.Root
				ref={ref}
				decorative={decorative}
				orientation={orientation}
				className={cn(
					`shrink-0 bg-${teamColor}-200 dark:bg-${teamColor}-800`,
					orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
					className
				)}
				{...props}
			/>
		)
	}
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
