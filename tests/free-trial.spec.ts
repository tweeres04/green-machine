import { test, expect } from '@playwright/test'

test.describe('Free Trial', () => {
	test('allows 3 games with stats then shows paywall', async ({ page }) => {
		const timestamp = Date.now()
		const email = `test-${timestamp}@example.com`
		const password = 'testpassword123'
		const teamName = `Test Team ${timestamp}`
		const teamSlug = `test-team-${timestamp}`

		// Step 1: Sign up
		await page.goto('/signup')
		await page.locator('#email_input').fill(email)
		await page.locator('#name_input').fill('Test User')
		await page.locator('#password_input').fill(password)
		await page.locator('#repeat_password_input').fill(password)
		await page.getByRole('button', { name: 'Sign up' }).click()

		// Should redirect to home page after signup
		await expect(page).toHaveURL('/')

		// Step 2: Create a team
		await page.goto('/teams/new')
		await page.waitForLoadState('networkidle')
		await page.locator('#name').fill(teamName)
		await page.locator('#slug').clear()
		await page.locator('#slug').fill(teamSlug)

		// Wait for slug availability check
		await expect(page.getByText('Slug available')).toBeVisible({
			timeout: 10000,
		})

		await page.getByRole('button', { name: 'Create Team' }).click()

		// Should redirect to team page
		await expect(page).toHaveURL(new RegExp(`/${teamSlug}`))

		// Step 3: Navigate to players page and add 2 players
		await page.goto(`/${teamSlug}/players`)

		await page.getByRole('button', { name: 'Add player' }).click()
		await page.locator('input[name="name"]').fill('Player One')
		await page.getByRole('button', { name: 'Save' }).click()
		await expect(page.getByText('Player One')).toBeVisible({ timeout: 10000 })
		await page.keyboard.press('Escape')

		await page.getByRole('button', { name: 'Add player' }).click()
		await page.locator('input[name="name"]').fill('Player Two')
		await page.getByRole('button', { name: 'Save' }).click()
		await expect(page.getByText('Player Two')).toBeVisible({ timeout: 10000 })
		await page.keyboard.press('Escape')

		// Step 4: Navigate to games page and create 4 games
		await page.goto(`/${teamSlug}/games`)

		for (let i = 1; i <= 4; i++) {
			await page.getByRole('button', { name: 'Add game' }).click()

			// Set the game date to the past (1 day ago, 8 days ago, 15 days ago, 22 days ago)
			const pastDate = new Date()
			pastDate.setDate(pastDate.getDate() - 1 - (i - 1) * 7)
			const dateString = pastDate.toISOString().slice(0, 16)
			await page.locator('#timestamp_input').fill(dateString)

			await page.locator('input[name="opponent"]').fill(`Opponent ${i}`)
			await page.getByRole('button', { name: 'Add' }).click()

			// Wait for the dialog to close (game was added successfully)
			await expect(page.getByRole('dialog')).not.toBeVisible({
				timeout: 10000,
			})
		}

		// Navigate back to team page for stats
		await page.goto(`/${teamSlug}`)

		// Step 5: Add stats to games 1, 2, 3 - should succeed
		for (let gameNum = 1; gameNum <= 3; gameNum++) {
			await page.getByRole('button', { name: 'Add stats' }).click()

			// Wait for dialog to open
			await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

			// Select the game from the dropdown
			await page.getByRole('combobox').first().click()
			await page.getByRole('option', { name: `Opponent ${gameNum}` }).click()

			// Add a goal for Player One - find the first button in the Player One row
			const playerOneRow = page
				.locator('li')
				.filter({ hasText: 'Player One' })
				.first()
			await playerOneRow.locator('button').first().click()

			// Submit the stats
			await page.getByRole('button', { name: 'Save' }).click()

			// Wait for dialog to close (stats successfully added)
			await expect(page.getByRole('dialog')).not.toBeVisible({
				timeout: 10000,
			})
		}

		// Step 6: Try to add stats to game 4 - should see paywall
		await page.getByRole('button', { name: 'Add stats' }).click()

		// Wait for dialog
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

		// Select game 4
		await page.getByRole('combobox').first().click()
		await page.getByRole('option', { name: 'Opponent 4' }).click()

		// Add a goal for Player One
		const playerOneRow = page
			.locator('li')
			.filter({ hasText: 'Player One' })
			.first()
		await playerOneRow.locator('button').first().click()

		// Submit the stats
		await page.getByRole('button', { name: 'Save' }).click()

		// Should see paywall error message
		await expect(
			page.getByText("You've tracked stats for 3 games, the max for free teams")
		).toBeVisible({ timeout: 10000 })

		// Should see subscribe button in the dialog
		await expect(
			page.getByRole('dialog').getByRole('link', { name: 'Subscribe for $19/year' })
		).toBeVisible()

		// Dialog should stay open (not close on error)
		await expect(page.getByRole('dialog')).toBeVisible()
	})
})
