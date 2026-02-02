# Free Trial Feature

## Overview

TeamStats uses a freemium model where teams can add stats for up to **3 games for free**. After that, they need an active subscription ($19/year) to continue adding stats to new games.

## Business Rules

### What Counts as a "Game with Stats"

A game counts toward the 3-game limit when it has **at least one stat entry** (goal or assist) associated with it via the `gameId` field in the `statEntries` table.

### What's Allowed (Free Teams)

- ✅ Add stats to games 1, 2, and 3
- ✅ Add multiple stats to the same game (doesn't count multiple times)
- ✅ Add more stats to an existing game that already has stats
- ✅ View all existing stats and game data
- ✅ Share stats and game details

### What's Blocked (Free Teams at Limit)

- ❌ Add stats to a 4th game (or any new game beyond the limit)
- ❌ Parse natural language stats that would create entries for a new game

### What's Always Allowed (Subscribed Teams)

- ✅ Unlimited stats for unlimited games
- ✅ All features without restrictions

## User-Facing Messaging

### Trial Status Alert

Displayed at the top of the team stats page (`$teamSlug`) for non-subscribed teams:

| Games Used | Message |
|------------|---------|
| 0 of 3 | "Track up to 3 games free. Subscribe for unlimited." |
| 1 of 3 | "You've used 1 of 3 free games. Subscribe for unlimited." |
| 2 of 3 | "You've used 2 of 3 free games. Subscribe for unlimited." |
| 3 of 3 | "Free trial complete! Subscribe to keep tracking stats." |

- Styled as an informational alert (using `Alert` component with default/informational variant)
- Links to Stripe checkout flow
- Hidden for teams with active subscriptions

### Paywall Message

When a free team tries to add stats to a 4th game:

- Return `402 Payment Required` status
- Show friendly error message: "You've used all 3 free games. Subscribe to keep tracking stats!"
- Include link to checkout

## Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `app/lib/getGamesWithStatsCount.ts` | Count distinct games with stats for a team |
| `app/lib/teamHasActiveSubscription.ts` | Add `FREE_GAMES_LIMIT` constant and `canAddStatsToGame()` helper |
| `app/routes/stats.tsx` | Enforce paywall when adding stats |
| `app/routes/$teamSlug_.tsx` | Display trial status alert |
| `app/components/ui/trial-status.tsx` | Trial status alert component |

### Key Functions

#### `getGamesWithStatsCount(teamId: number): Promise<number>`

Returns count of distinct games that have at least one stat entry for the team.

**Query logic:**
```typescript
// Count distinct gameIds from statEntries
// Join through players to filter by teamId
// Where gameId is not null
```

#### `canAddStatsToGame(subscription, gamesWithStatsCount, gameAlreadyHasStats): boolean`

Determines if a team can add stats to a game.

**Logic:**
1. If team has active subscription → always `true`
2. If game already has stats → always `true` (adding to existing)
3. If gamesWithStatsCount < 3 → `true` (under limit)
4. Otherwise → `false` (over limit)

### Database Schema Reference

**statEntries table:**
- `id` - Primary key
- `playerId` - FK to players
- `gameId` - FK to games (nullable)
- `type` - 'goal' or 'assist'
- `timestamp` - When stat occurred

**games table:**
- `id` - Primary key
- `teamId` - FK to teams
- `opponent`, `timestamp`, `location`, `cancelledAt`

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Adding stats with manual date entry | Creates a game (with timestamp only) and counts toward the limit |
| Editing existing stats | Always allowed (no new games created) |
| Deleting stats from a game | Doesn't reduce count (we don't "give back" free games) |
| Team subscribes after hitting limit | Immediately unlocked, can add unlimited stats |
| Legacy data (teams with >3 games but no subscription) | Currently all teams are subscribed, so not applicable |

## Checkout Flow

When users click "Subscribe" from the trial status alert or paywall message:

1. The "Subscribe" buttons link to the team-specific subscribe route: `/teams/:teamId/subscribe`
2. That route calls `createStripeCheckoutSession.server.ts` to create a Stripe Checkout Session with the correct price and success/cancel URLs
3. The user is redirected to the Stripe-hosted checkout page, and after completion is sent back to the app via the configured return URLs (`/thankyou` or `/canceled`)

## Future Considerations

- Should we show trial status in other locations? (Settings page, games page?)
- Analytics: Track how many teams hit the free limit before subscribing
- Consider showing "1 game remaining" earlier to encourage subscription
- A/B test different messaging
