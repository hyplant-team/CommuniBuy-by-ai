import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Keep these startup checks isolated from the team's running backend.
  await page.route('**/api/v1/**', (route) => route.abort('failed'))
})

test('removes the startup placeholder when the login route is ready', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '登录，发现好团购' })).toBeVisible()
  await expect(page.locator('#startup-screen')).toHaveCount(0)
})

test('shows a recoverable startup error if the entry script fails to load', async ({ page }) => {
  await page.route('**/src/main.ts', (route) => route.abort('failed'))
  await page.goto('/login')
  await expect(page.locator('#startup-title')).toHaveText('页面暂时无法加载')
  await expect(page.getByRole('button', { name: '重新加载页面' })).toBeVisible()
  await expect(page.locator('#startup-screen')).toHaveAttribute('aria-busy', 'false')
})

test('keeps waiting on a slow entry script and recovers when it arrives', async ({ page }) => {
  await page.clock.install()
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/src/main.ts', async (route) => {
    await ready
    await route.continue()
  })
  try {
    await page.goto('/login', { waitUntil: 'commit' })
    await page.waitForFunction(() => document.readyState === 'interactive')
    await expect(page.locator('#startup-title')).toHaveText('正在进入社区团购平台')
    await page.clock.fastForward(10001)
    await expect(page.locator('#startup-title')).toHaveText('页面加载较慢')
    await expect(page.locator('#startup-retry')).toBeHidden()
    release()
    await expect(page.getByLabel('账号', { exact: true })).toBeVisible()
    await expect(page.locator('#startup-screen')).toHaveCount(0)
  } finally {
    release()
  }
})

test('shows a login-specific connection error without an order warning', async ({ page }) => {
  let writes = 0
  await page.route('**/api/v1/auth', (route) => {
    if (route.request().method() === 'POST') writes++
    return route.abort('failed')
  })
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill('network_test')
  await page.getByLabel('密码', { exact: true }).fill('test-only-password')
  await page.getByRole('button', { name: '登录，发现好团购' }).click()
  await expect(page.locator('.error-notice')).toContainText('暂时无法连接登录服务')
  await expect(page.locator('.error-notice')).not.toContainText('订单')
  expect(writes).toBe(1)
})
