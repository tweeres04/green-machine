# Chat platform limitations for bots and integrations

Notes from research on April 16, 2026 when considering a chatbot for TeamStats. Saving this so we don't re-research it the next time the idea comes up.

## Table of contents

- [TL;DR](#tldr)
- [What each platform allows](#what-each-platform-allows)
- [Why Meta locked it down](#why-meta-locked-it-down)
- [What you can still do on Messenger and WhatsApp](#what-you-can-still-do-on-messenger-and-whatsapp)
- [Options if we want a real group chat bot](#options-if-we-want-a-real-group-chat-bot)
- [Recommendation for TeamStats](#recommendation-for-teamstats)

## TL;DR

You cannot add a bot, app, or integration to a Facebook Messenger or WhatsApp group chat. Both platforms only support 1-on-1 bots through a Facebook Page or WhatsApp Business account. If we want a bot that lives in a group chat (like Slack or Discord bots), we'd have to move the team off Messenger/WhatsApp onto Telegram, Discord, or similar.

## What each platform allows

| Platform | Bot in group chat? | Bot 1-on-1? | Notes |
|----------|-------------------|-------------|-------|
| Facebook Messenger | No | Yes (via Page) | Chat Extensions were deprecated years ago |
| WhatsApp | No | Yes (via Business API) | Business API is locked down, requires approval |
| Telegram | Yes | Yes | Easiest platform to develop for, free, no approval needed |
| Discord | Yes | Yes | Great for servers, overkill for a rec team |
| Slack | Yes | Yes | Paid for real workspaces, aimed at work teams |
| iMessage | No | No | No third-party bot API at all |

## Why Meta locked it down

Best guesses based on industry commentary:

1. **Spam prevention.** Group chats are intimate spaces. Bots in groups are an easy vector for spam and abuse, and Meta got burned by this in the early Messenger Platform days.
2. **Privacy positioning.** WhatsApp especially leans on end-to-end encryption and privacy. Third-party software reading group messages undercuts that story even when users opt in.
3. **Business model.** Meta wants businesses talking to individual customers through Pages and Business accounts, where they can sell ads and paid messaging. Sitting inside friend groups doesn't fit that model.

## What you can still do on Messenger and WhatsApp

All manual, human-initiated:

- **Rich link previews.** If someone pastes a URL in the chat, the platform generates a preview card from Open Graph metadata. A player could paste `teamstats.app/g/abc123` and everyone sees a nice card with game details.
- **Share to Messenger button.** A web button that opens Messenger with a pre-filled message. Still requires the user to pick a chat and tap send.
- **m.me / wa.me deep links.** Links that open Messenger or WhatsApp to a specific page or phone number. Useful for 1-on-1, not groups.
- **Native polls.** Both platforms have built-in polls, but they can only be created manually through the app UI. No API.

## Options if we want a real group chat bot

1. **Move to Telegram.** Free, no approval, bots just work in groups. The team would have to install Telegram and join a new group.
2. **Move to Discord.** Same as Telegram but more complex. Overkill unless the team wants voice, channels, etc.
3. **Do a 1-on-1 Messenger or WhatsApp bot.** Each player messages the bot directly. Different UX from group coordination but still useful for individual queries like "when's my next game?"
4. **Skip chat entirely.** Build a shareable web page per team. Someone pastes the link in the existing group chat when needed. The Open Graph preview does the heavy lifting.

## Recommendation for TeamStats

For now, option 4 is probably the right call:

- Keep the existing Messenger group chat as-is. It works.
- Build shareable short links in TeamStats that generate nice Open Graph previews for next game, leaderboard, weather.
- Someone on the team pastes the link when useful. Low effort, no platform lock-in, no approval process.

If we later decide chat automation is worth a platform migration, Telegram with an LLM-powered bot (Claude, Gemini, or GPT with tool calling against the TeamStats database) would be the path. That would let players ask natural questions like "did we win last week?" or "who's been scoring lately?" without hand-coding every phrasing. Tradeoffs: cost per message (roughly $0.001 to $0.01), added latency (1 to 3 seconds), and guardrails needed to keep the model grounded in real data.
