# Agent Instructions for green-machine

This document provides coding standards and conventions for the green-machine project, a team stats tracking application built with Remix.

## What is TeamStats?

TeamStats is a simple app for recreational soccer teams to track player stats (goals, assists) and manage game schedules. Target users are adult "beer league" players who want:

- Leaderboards showing the "golden boot" race throughout the season
- Easy schedule management
- Shareable stats and game details for group chats
- AI-powered features (natural language stat entry, schedule imports)
- Weather forecasts for upcoming games

The product is positioned as **small, focused, and affordable** ($19/year) vs. bloated competitors. Simplicity is a feature, not a limitation. Users describe checking stats as a "dopamine hit" - the app makes recreational soccer more fun by giving teams something to celebrate together.

## Project Overview

- **Framework**: Remix v2.13 with Vite
- **Language**: TypeScript (strict mode enabled)
- **Database**: SQLite with Drizzle ORM (@libsql/client)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: remix-auth with form-based strategy
- **Validation**: Zod schemas

## Build, Lint, and Test Commands

### Development

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Run production server
npm run typecheck        # Run TypeScript type checking
npm run lint             # Run ESLint
```

### Database Commands

```bash
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI
npm run db:dev:reset     # Reset local database (WARNING: deletes all data)
npm run db:download      # Download database from production server
```

### Utility Scripts

```bash
npm run hash_password    # Generate password hash
```

### Human-Only Operations (NEVER RUN AS AGENT)

The following commands are restricted and must NEVER be executed by AI agents. They perform critical operations that require human oversight:

```bash
npm run deploy           # Deploys to production server (humans only)
npx tsx tasks/*.ts       # One-time data migration scripts (humans only)
```

**Why restricted:**
- `deploy` pushes code to production and could cause downtime
- `tasks/*.ts` scripts are one-time migrations that modify production data

Note: This project does not currently have a test suite configured.

## Code Style Guidelines

### Formatting (enforced by Prettier)

- **Indentation**: Use tabs (displayed as 2 spaces)
- **Semicolons**: No semicolons
- **Quotes**: Single quotes for strings
- **Line width**: Default (80 characters recommended)

### Import Organization

Organize imports in this order:

1. External packages (React, Remix, third-party libraries)
2. Internal type imports (from `@remix-run/node`, etc.)
3. App imports using `~/` alias (components, lib, schema)
4. Relative imports (if necessary, but prefer `~/` alias)

```typescript
import { useState, useEffect } from 'react'
import { Link, useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'

import { Button } from '~/components/ui/button'
import { getDb } from '~/lib/getDb'
import { authenticator } from '~/lib/auth.server'
import { games, teams } from '~/schema'
```

### TypeScript Conventions

#### Type Inference

- Prefer type inference from Drizzle schema using `$inferSelect`
- Export types alongside schema definitions in `app/schema.ts`

```typescript
export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
})

export type Team = typeof teams.$inferSelect
```

#### Typed Database Columns

Use `.$type<T>()` for custom types in Drizzle schemas:

```typescript
subscriptionStatus: text('subscription_status')
	.$type<Stripe.Subscription.Status>()
	.notNull()
```

#### Function Arguments

Always type function parameters, especially for Remix loaders/actions:

```typescript
export async function loader({ params, request }: LoaderFunctionArgs) {
	// ...
}

export async function action({ params, request }: ActionFunctionArgs) {
	// ...
}
```

### Component Patterns

#### React Components

- Use function declarations for default exports
- Use arrow functions for internal components
- Always type component props with interfaces or types

```typescript
interface GameCardProps {
	game: Game
	team: Team
	userHasAccessToTeam: boolean
}

export default function GameCard({
	game,
	team,
	userHasAccessToTeam,
}: GameCardProps) {
	// ...
}
```

#### shadcn/ui Components

- Use `class-variance-authority` (cva) for variant-based styling
- Combine classes with the `cn()` utility from `~/lib/utils`
- Support `asChild` prop pattern for composition

```typescript
const buttonVariants = cva('base-classes', {
	variants: {
		variant: {
			default: 'variant-classes',
			destructive: 'destructive-classes',
		},
	},
	defaultVariants: {
		variant: 'default',
	},
})
```

### Naming Conventions

- **Files**: kebab-case (e.g., `auth.server.ts`, `use-toast.ts`)
- **Components**: PascalCase files and exports (e.g., `Button.tsx`, `export function Button()`)
- **Routes**: Remix conventions with `$param` for dynamic segments, `.` for nested layouts
- **Server files**: Use `.server.ts` suffix for server-only code
- **Database tables**: snake_case in schema, camelCase in TypeScript
- **Functions**: camelCase (e.g., `getUserById`, `hasAccessToTeam`)
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for config objects

### Error Handling

#### Assertions

Use `tiny-invariant` for runtime assertions:

```typescript
import invariant from 'tiny-invariant'

invariant(teamSlug, 'Missing teamSlug parameter')
invariant(user, 'User must be authenticated')
```

#### HTTP Errors

Throw Response objects for HTTP errors:

```typescript
if (!user) {
	throw new Response(null, { status: 401 })
}

if (!team) {
	throw new Response('Team not found', { status: 404 })
}
```

#### Try-Catch

Use try-catch for specific error types (e.g., database constraints):

```typescript
try {
	await db.insert(users).values({ email, password })
} catch (error) {
	if (
		error instanceof LibsqlError &&
		error.code === 'SQLITE_CONSTRAINT_UNIQUE'
	) {
		throw new Error('Email already taken')
	}
	throw error
}
```

## Architecture

### File Structure

```
app/
├── components/ui/          # shadcn/ui components
├── lib/                    # Utility functions and helpers
│   ├── *.server.ts         # Server-only code
│   └── *.ts                # Shared utilities
├── routes/                 # Remix route files
├── schema.ts               # Drizzle schema definitions
├── root.tsx                # Root layout
└── tailwind.css            # Tailwind entry point
```

### Route Patterns

- `$teamSlug.games.tsx` - Dynamic param with nested route
- `games.$gameId.ts` - Action-only route (no UI)
- `games.$gameId.destroy.ts` - Specific action route
- `_index.tsx` - Index route
- `$teamSlug_.tsx` - Pathless layout route

### Database Access

- Always use `getDb()` function to get database instance
- Use Drizzle query API for complex queries with relations
- Use Drizzle SQL builders for simple CRUD operations

```typescript
const db = getDb()

// Query API (with relations)
const team = await db.query.teams.findFirst({
	where: (teams, { eq }) => eq(teams.slug, teamSlug),
	with: {
		games: true,
		players: true,
	},
})

// SQL Builder
await db.insert(games).values({ teamId, opponent, timestamp })
await db.update(games).set({ opponent }).where(eq(games.id, gameId))
```

## Common Patterns

### Loader Pattern

```typescript
export async function loader({ params, request }: LoaderFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)
	const db = getDb()

	// Fetch data
	const team = await db.query.teams.findFirst({
		/* ... */
	})

	if (!team) {
		throw new Response('Not found', { status: 404 })
	}

	return json({ team, user })
}
```

### Action Pattern

```typescript
export async function action({ params, request }: ActionFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const formData = await request.formData()
	const db = getDb()

	// Process action
	await db.insert(table).values({
		/* ... */
	})

	return json({ success: true })
}
```

### Authentication Check

```typescript
const user = await authenticator.isAuthenticated(request)
const userHasAccessToTeam = await hasAccessToTeam(user, teamId)

if (!userHasAccessToTeam) {
	throw new Response(null, { status: 403 })
}
```

### Form Handling with useFetcher

```typescript
const fetcher = useFetcher()
const saving = fetcher.state !== 'idle'

return (
	<fetcher.Form action="/games" method="post">
		<fieldset disabled={saving}>
			<Input name="opponent" required />
			<Button type="submit">Save</Button>
		</fieldset>
	</fetcher.Form>
)
```

## Key Files to Know

- `app/schema.ts` - All database table definitions and types
- `app/lib/auth.server.ts` - Authentication logic
- `app/lib/getDb.ts` - Database connection
- `app/root.tsx` - Root layout with context providers
- `drizzle.config.ts` - Drizzle Kit configuration
- `tailwind.config.ts` - Tailwind configuration with team colors
