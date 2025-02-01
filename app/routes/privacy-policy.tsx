import '~/resources.css'

export default function PrivacyPolicy() {
	return (
		<article className="resources">
			<h1>Privacy Policy</h1>

			<section>
				<h2>What I Collect</h2>
				<ul>
					<li>Basic usage data like page views and feature interactions</li>
					<li>Performance metrics to identify potential issues</li>
					<li>Anonymous analytics to understand how teams use TeamStats</li>
				</ul>
			</section>

			<section>
				<h2>How I Use Your Data</h2>
				<ul>
					<li>Improve TeamStats features and user experience</li>
					<li>Fix bugs and optimize performance</li>
					<li>Make informed decisions about new features</li>
				</ul>
			</section>

			<section>
				<h2>What I Don't Do</h2>
				<ul>
					<li>Sell your data to third parties</li>
					<li>Share your team's statistics without your permission</li>
					<li>Track individual users across other websites</li>
				</ul>
			</section>

			<section>
				<h2>Analytics</h2>
				<p>
					I use standard analytics tools to understand how TeamStats is used.
					This helps me make the app better for everyone.
				</p>
			</section>

			<section>
				<h2>Your Control</h2>
				<ul>
					<li>You can request a copy of your data</li>
					<li>You can ask me to delete your data</li>
					<li>Contact me through support channels with any privacy concerns</li>
				</ul>
			</section>

			<section>
				<h2>Updates</h2>
				<p>
					I'll notify you about significant changes to this privacy policy
					through the app.
				</p>
			</section>

			<footer>
				<p>Last updated: February 2025</p>
			</footer>
		</article>
	)
}
