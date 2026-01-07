import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const teamColors = [
	'gray',
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
	'pink',
]

const safelist = teamColors.flatMap((teamColor) => {
	return [
		`bg-${teamColor}-50`,
		`bg-${teamColor}-100`,
		`bg-${teamColor}-200`,
		`bg-${teamColor}-300`,
		`bg-${teamColor}-900`,
		`data-[state=checked]:bg-${teamColor}-900`,
		`data-[state=checked]:text-${teamColor}-50`,
		`dark:data-[state=checked]:bg-${teamColor}-50`,
		`border-${teamColor}-200`,
		`border-${teamColor}-900`,
		`border-l-${teamColor}-900`,
		`hover:bg-${teamColor}-100`,
		`hover:bg-${teamColor}-900`,
		`hover:bg-${teamColor}-100`,
		`hover:bg-${teamColor}-100/80`,
		`hover:text-${teamColor}-900`,
		`hover:text-${teamColor}-900`,
		`text-${teamColor}-50`,
		`text-${teamColor}-500`,
		`text-${teamColor}-900`,
		`text-${teamColor}-950`,
		`focus:bg-${teamColor}-100`,
		`focus:text-${teamColor}-900`,
		`focus-visible:ring-${teamColor}-950`,
		`dark:bg-${teamColor}-900`,
		`dark:bg-${teamColor}-800`,
		`dark:bg-${teamColor}-950`,
		`dark:text-${teamColor}-50`,
		`dark:text-${teamColor}-400`,
		`dark:text-${teamColor}-900`,
		`dark:border-${teamColor}-800`,
		`dark:focus-visible:ring-${teamColor}-300`,
		`dark:data-[state=checked]:bg-${teamColor}-50`,
		`dark:data-[state=checked]:text-${teamColor}-900`,
		`dark:hover:bg-${teamColor}-50/90`,
		`dark:hover:bg-${teamColor}-800`,
		`dark:hover:bg-${teamColor}-800/80`,
		`dark:hover:text-${teamColor}-50`,
		`dark:focus:bg-${teamColor}-800`,
		`dark:focus:text-${teamColor}-50`,
	]
})

const config: Config = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	prefix: '',
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			fontFamily: {
				sans: ['Nunito Sans Variable', ...defaultTheme.fontFamily.sans],
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	safelist,
	plugins: [require('tailwindcss-animate')],
}

export default config
