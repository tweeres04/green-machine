import type { Config } from 'tailwindcss'

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
		`bg-${teamColor}-900`,
		`border-${teamColor}-200`,
		`hover:bg-${teamColor}-100`,
		`hover:bg-${teamColor}-900`,
		`hover:bg-${teamColor}-100`,
		`hover:bg-${teamColor}-100/80`,
		`hover:text-${teamColor}-900`,
		`hover:text-${teamColor}-900`,
		`text-${teamColor}-50`,
		`text-${teamColor}-900`,
		`text-${teamColor}-950`,
		`dark:text-${teamColor}-50`,
		`focus:bg-${teamColor}-100`,
		`focus:text-${teamColor}-900`,
		`focus-visible:ring-${teamColor}-950`,
		`dark:bg-${teamColor}-900`,
		`dark:bg-${teamColor}-800`,
		`dark:bg-${teamColor}-950`,
		`dark:text-${teamColor}-50`,
		`dark:text-${teamColor}-900`,
		`dark:text-${teamColor}-50`,
		`dark:border-${teamColor}-800`,
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
