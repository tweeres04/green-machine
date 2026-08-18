import Mailgun from 'mailgun.js'
import invariant from 'tiny-invariant'
import { User } from '~/schema'
import { emailHtml, escapeHtml } from '~/lib/email-html.server'

export async function sendWelcomeEmail(user: User) {
	invariant(process.env.MAILGUN_API_KEY, 'No MAILGUN_API_KEY')
	invariant(process.env.MAILGUN_DOMAIN, 'No MAILGUN_DOMAIN')
	invariant(process.env.BASE_URL, 'No BASE_URL')

	const mailgun = new Mailgun(FormData)
	const mg = mailgun.client({
		username: 'api',
		key: process.env.MAILGUN_API_KEY,
	})

	return mg.messages.create(process.env.MAILGUN_DOMAIN, {
		from: 'Tyler at TeamStats <hello@teamstats.tweeres.com>',
		to: user.email,
		// Replies land nowhere unless this points at a real inbox, and the copy
		// below promises someone reads them
		...(process.env.SUPPORT_EMAIL
			? { 'h:Reply-To': process.env.SUPPORT_EMAIL }
			: {}),
		subject: 'Welcome to TeamStats',
		text: `Hi ${user.name},

You're in.

Add your players and a game, then start logging goals. You'll have a golden boot race going by the weekend.

Set up your team: ${process.env.BASE_URL}/teams/new

Your first three games are free. After that it's $19 a year for the whole team.

Hit reply if something breaks or doesn't make sense. I read every one.

Tyler`,
		html: emailHtml(`<p>Hi ${escapeHtml(user.name)},</p>
<p>You're in.</p>
<p>Add your players and a game, then start logging goals. You'll have a golden boot race going by the weekend.</p>
<p><a href="${process.env.BASE_URL}/teams/new">Set up your team</a></p>
<p>Your first three games are free. After that it's $19 a year for the whole team.</p>
<p>Hit reply if something breaks or doesn't make sense. I read every one.</p>
<p>Tyler</p>`),
	})
}
