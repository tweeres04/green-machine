import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './app/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: 'database.db',
	},
})
