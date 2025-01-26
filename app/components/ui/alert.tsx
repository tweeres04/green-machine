import * as React from 'react'
import { useContext } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { TeamColorContext } from '~/lib/teamColorContext'
import { cn } from '~/lib/utils'

const alertVariants = cva(
	'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
	{
		variants: {
			variant: {
				default: 'bg-white text-950 dark:bg-950 dark:text-50',
				destructive:
					'border-red-500/50 text-red-500 dark:border-red-500 [&>svg]:text-red-500 dark:border-red-900/50 dark:text-red-900 dark:dark:border-red-900 dark:[&>svg]:text-red-900',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
)

const Alert = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => {
	const teamColor = useContext(TeamColorContext)
	return (
		<div
			ref={ref}
			role="alert"
			className={cn(
				alertVariants({ variant }),
				`border-${teamColor}-200 dark:border-${teamColor}-800 [&>svg]:text-${teamColor}-950 dark:[&>svg]:text-${teamColor}-50`,
				className
			)}
			{...props}
		/>
	)
})
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h5
		ref={ref}
		className={cn('mb-1 font-medium leading-none tracking-tight', className)}
		{...props}
	/>
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn('text-sm [&_p]:leading-relaxed', className)}
		{...props}
	/>
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
