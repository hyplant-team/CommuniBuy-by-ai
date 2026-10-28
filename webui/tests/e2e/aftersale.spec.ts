import { expect, test, type Page, type Route } from '@playwright/test'
import { encodeJson } from '../../src/utils/json'

const orderId = '9007199254740995'
const refundId = '55555555-5555-4555-8555-555555555555'
const now = Math.floor(Date.now() / 1000)
const order = {
  id: BigInt(orderId),
  itemId: 1,
  user: 'buyer',
  owner: 'seller',
  quantity: 1,
  price: 1490,
  total: 1490,
  address: '测试地址',
  status: 1,
  createTime: now,
  payTime: now,
  shipTime: null,
  receiptTime: null,
  closeTime: null,
  expiresAt: now + 900,
  refundStatus: 'NONE',
  itemName: '测试团购',
  itemDescription: '',
  snapshotSource: 'AT_CREATION',
  refundedTotal: 0,
}
const refund = {
  id: refundId,
  orderId: BigInt(orderId),
  paymentId: '11111111-1111-4111-8111-111111111111',
  amount: 1490,
  reason: '测试售后原因',
  status: 'REQUESTED',
  attempts: 0,
  providerReference: null,
  createTime: now,
  updateTime: now,
}
async function reply(route: Route, data: unknown, status = 200, message = '') {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: encodeJson({
      success: status < 400,
      code: status < 400 ? 'OK' : 'TEST_ERROR',
      data,
      message,
      traceId: 'aftersale-test-trace',
    }),
  })
}
async function backend(page: Page, user = 'seller') {
  await page.addInitScript(() => sessionStorage.setItem('communibuy.token', 'aftersale-test-token'))
  const queries: URL[] = []
  const actions: string[] = []
  const unexpected: string[] = []
  const state = {
    refund: { ...refund },
    lookup: true,
    lookupError: 0,
    lookupMessage: '',
    count: 41,
    listError: 0,
  }
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.slice('/api/v1'.length)
    const method = route.request().method()
    if (path === '/auth' && method === 'GET')
      return reply(route, {
        id: user,
        nickname: user,
        address: '',
        description: '',
        role: user === 'admin' ? 1 : 0,
      })
    if (path === '/item' && method === 'GET')
      return reply(route, { content: [], count: 0, page: 0, size: 10 })
    if (path === '/order' && method === 'GET')
      return reply(route, { content: [order], count: 1, page: 0, size: 10 })
    if (path === '/refunds' && method === 'GET') {
      queries.push(url)
      if (state.listError) return reply(route, null, state.listError, 'Access denied')
      return reply(route, {
        content: [{ ...state.refund, buyer: 'buyer', seller: 'seller' }],
        count: state.count,
        page: Number(url.searchParams.get('page')),
        size: 20,
      })
    }
    if (path === `/order/${orderId}/details` && method === 'GET')
      return reply(route, {
        order,
        lines: [
          {
            itemId: 1,
            quantity: 1,
            price: 1490,
            total: 1490,
            itemName: '测试团购',
            itemDescription: '',
            snapshotSource: 'AT_CREATION',
          },
        ],
      })
    if (path === `/order/${orderId}/refunds` && method === 'GET')
      return reply(
        route,
        state.lookup ? state.refund : null,
        state.lookupError || 200,
        state.lookupMessage
      )
    if (path === `/refunds/${refundId}` && method === 'GET') return reply(route, state.refund)
    if (path === `/refunds/${refundId}/approve` && method === 'POST') {
      actions.push(path)
      state.refund.status = 'SUCCEEDED'
      return reply(route, state.refund)
    }
    unexpected.push(`${method} ${path}`)
    return reply(route, null, 500, `Unexpected test endpoint ${method} ${path}`)
  })
  return { state, queries, actions, unexpected }
}

test('seller discovers requests from workbench, approves with confirmation, and opens the exact order', async ({
  page,
}) => {
  const mock = await backend(page)
  await page.goto('/seller/items')
  const heading = page.locator('.heading-actions')
  await expect(heading.getByRole('link', { name: '销售订单' })).toHaveAttribute(
    'href',
    '/seller/orders'
  )
  await heading.getByRole('link', { name: '售后管理' }).click()
  await expect(page.getByRole('heading', { name: '售后管理', exact: true })).toBeVisible()
  await expect.poll(() => mock.queries.at(-1)?.searchParams.get('scope')).toBe('seller')
  expect(mock.queries.at(-1)?.searchParams.get('status')).toBe('REQUESTED')
  await page.getByRole('link', { name: '查看 / 处理售后 →' }).click()
  await expect(page.getByText('等待审核', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '批准退款' }).click()
  expect(mock.actions).toHaveLength(0)
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click()
  await expect(page.getByText('退款成功', { exact: true })).toBeVisible()
  expect(mock.actions).toHaveLength(1)
  await page.getByRole('link', { name: '查看订单', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`))
  await expect(page.getByText('已退款', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '← 返回订单' })).toHaveAttribute(
    'href',
    '/seller/orders'
  )
  expect(mock.unexpected).toEqual([])
})

test('buyer discovers their own requests, follows order entry, and never gets review actions', async ({
  page,
}) => {
  const mock = await backend(page, 'buyer')
  await page.goto('/orders')
  await page.getByRole('link', { name: '查看售后', exact: true }).click()
  await expect(page.getByRole('heading', { name: '我的售后', exact: true })).toBeVisible()
  await expect.poll(() => mock.queries.at(-1)?.searchParams.get('orderId')).toBe(orderId)
  expect(mock.queries.at(-1)?.searchParams.get('scope')).toBe('buyer')
  expect(mock.queries.at(-1)?.searchParams.has('status')).toBe(false)
  await page.getByRole('link', { name: '查看进度 →' }).click()
  await expect(page.getByText('等待审核', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '批准退款' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '拒绝申请' })).toHaveCount(0)
  await page.getByRole('link', { name: '返回售后列表', exact: true }).click()
  await expect(page).toHaveURL(/\/refunds$/)
  await page.goto('/admin/refunds')
  await expect(page).toHaveURL(/\/403$/)
  expect(mock.queries.some((url) => url.searchParams.get('scope') === 'all')).toBe(false)
  expect(mock.unexpected).toEqual([])
})

test('admin explicitly requests all scope and navigation fits desktop and mobile', async ({
  page,
}) => {
  const mock = await backend(page, 'admin')
  await page.goto('/admin/refunds')
  await expect(page.getByRole('heading', { name: '全部售后', exact: true })).toBeVisible()
  await expect.poll(() => mock.queries.at(-1)?.searchParams.get('scope')).toBe('all')
  for (const width of [1440, 1024, 1001, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    expect(
      await page.locator('.header-actions').evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return rect.left >= 0 && rect.right <= innerWidth
      })
    ).toBe(true)
  }
  await page.screenshot({ path: 'test-results/aftersale-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: 'test-results/aftersale-desktop.png', fullPage: true })
  expect(mock.unexpected).toEqual([])
})

test('filters reset pagination, preserve large order IDs, and reject invalid IDs without a request', async ({
  page,
}) => {
  const mock = await backend(page)
  await page.goto('/seller/refunds')
  await expect(page.getByRole('link', { name: '查看 / 处理售后 →' })).toBeVisible()
  await page.locator('.el-pager li').filter({ hasText: /^2$/ }).click()
  await expect.poll(() => mock.queries.at(-1)?.searchParams.get('page')).toBe('1')
  await page.getByRole('textbox', { name: '筛选订单编号' }).fill(orderId)
  await page.getByRole('button', { name: '查询售后' }).click()
  await expect.poll(() => mock.queries.at(-1)?.searchParams.get('orderId')).toBe(orderId)
  expect(mock.queries.at(-1)?.searchParams.get('page')).toBe('0')
  await page.getByRole('combobox', { name: '售后状态' }).press('ArrowDown')
  await page.getByRole('option', { name: '退款失败', exact: true }).click()
  await expect.poll(() => mock.queries.at(-1)?.searchParams.get('status')).toBe('FAILED')
  const count = mock.queries.length
  await page.getByRole('textbox', { name: '筛选订单编号' }).fill('1.5')
  await page.getByRole('button', { name: '查询售后' }).click()
  await expect(page.getByRole('alert')).toContainText('资源编号无效')
  await expect(page.getByRole('link', { name: '查看 / 处理售后 →' })).toHaveCount(0)
  expect(mock.queries).toHaveLength(count)
  expect(mock.unexpected).toEqual([])
})

test('failed refund filtering clears the previous results and can recover', async ({ page }) => {
  const mock = await backend(page)
  await page.goto('/seller/refunds')
  await expect(page.getByRole('link', { name: '查看 / 处理售后 →' })).toBeVisible()
  mock.state.listError = 403
  await page.getByRole('combobox', { name: '售后状态' }).press('ArrowDown')
  await page.getByRole('option', { name: '退款失败', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('权限')
  await expect(page.getByRole('link', { name: '查看 / 处理售后 →' })).toHaveCount(0)
  await expect(page.getByText('售后记录加载失败，请重试')).toBeVisible()
  await expect(page.getByText('暂无符合条件的售后申请')).toHaveCount(0)
  mock.state.listError = 0
  await page.getByRole('button', { name: '重新加载' }).click()
  await expect(page.getByRole('link', { name: '查看 / 处理售后 →' })).toBeVisible()
  expect(mock.queries.at(-1)?.searchParams.get('status')).toBe('FAILED')
  expect(mock.unexpected).toEqual([])
})

test('order lookup uses actual refund status and a successful null alone enables a new application', async ({
  page,
}) => {
  const mock = await backend(page, 'buyer')
  await page.goto(`/orders/${orderId}`)
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '订单售后', exact: true }) })
  await expect(panel.getByText('待审核', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '提交售后申请' })).toHaveCount(0)
  await expect(panel.getByRole('link', { name: '查看 / 处理售后' })).toHaveAttribute(
    'href',
    `/refunds/${refundId}`
  )
  mock.state.lookup = false
  await page.getByRole('button', { name: '刷新状态' }).click()
  await expect(panel.getByText('该订单暂未申请售后。')).toBeVisible()
  await expect(page.getByRole('button', { name: '提交售后申请' })).toBeVisible()
  expect(mock.unexpected).toEqual([])
})

for (const status of [403, 500]) {
  test(`order refund lookup ${status} stays an error and can recover without hiding order details`, async ({
    page,
  }) => {
    const mock = await backend(page, 'buyer')
    mock.state.lookupError = status
    mock.state.lookupMessage = status === 403 ? 'Access denied' : 'Internal server error'
    await page.goto(`/orders/${orderId}`)
    await expect(page.getByRole('heading', { name: '订单明细', exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(status === 403 ? '权限' : '异常')
    await expect(page.getByText('该订单暂未申请售后。')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '提交售后申请' })).toHaveCount(0)
    mock.state.lookupError = 0
    await page.getByRole('button', { name: '重新加载' }).click()
    await expect(page.getByText('待审核', { exact: true })).toBeVisible()
    expect(mock.unexpected).toEqual([])
  })
}

for (const [message, expected] of [
  ['密码错误，请重新输入', '密码错误，请重新输入'],
  ['Invalid credentials', '登录失败：账号或密码错误，或账号已被停用。'],
])
  test(`login displays Chinese feedback without diagnostic IDs: ${message}`, async ({ page }) => {
    await page.route('**/api/v1/**', (route) => reply(route, null, 401, message))
    await page.goto('/login')
    await page.getByLabel('账号', { exact: true }).fill('test_buyer')
    await page.getByLabel('密码', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: '登录，发现好团购' }).click()
    await expect(page.getByRole('alert')).toContainText(expected!)
    await expect(page.getByRole('alert')).not.toContainText('aftersale-test-trace')
    await expect(page.getByRole('alert')).not.toContainText('排查编号')
    await expect(page).toHaveURL(/\/login$/)
  })
