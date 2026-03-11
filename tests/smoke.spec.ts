import { test, expect } from '@playwright/test'

test.describe('Smoke Test', () => {
	test('can visit the homepage', async ({ page }) => {
		await page.goto('/')
		await expect(
			page.getByRole('heading', { name: 'TeamStats', exact: true })
		).toBeVisible()
	})

	test('can visit the signup page', async ({ page }) => {
		await page.goto('/signup')
		await expect(page.locator('#email_input')).toBeVisible()
		await expect(page.locator('#name_input')).toBeVisible()
		await expect(page.locator('#password_input')).toBeVisible()
	})
})
