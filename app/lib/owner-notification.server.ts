import Mailgun from 'mailgun.js'
import invariant from 'tiny-invariant'

// Heads-up emails to whoever runs TeamStats. Opt in by setting SUPPORT_EMAIL;
// with nowhere to send them, nothing is sent
export async function notifyOwner({
	subject,
	text,
}: {
	subject: string
	text: string
}) {
	if (!process.env.SUPPORT_EMAIL) {
		return
	}

	invariant(process.env.MAILGUN_API_KEY, 'No MAILGUN_API_KEY')
	invariant(process.env.MAILGUN_DOMAIN, 'No MAILGUN_DOMAIN')

	const mailgun = new Mailgun(FormData)
	const mg = mailgun.client({
		username: 'api',
		key: process.env.MAILGUN_API_KEY,
	})

	return mg.messages.create(process.env.MAILGUN_DOMAIN, {
		from: 'TeamStats <notifications@teamstats.tweeres.com>',
		to: process.env.SUPPORT_EMAIL,
		subject,
		text,
	})
}
