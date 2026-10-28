import { expect, test, type Page, type Route } from '@playwright/test'
import { encodeJson } from '../../src/utils/json'

const itemId = '9007199254740993'
const orderId = '9007199254740995'
const paymentId = '11111111-1111-4111-8111-111111111111'
const checkoutId = '22222222-2222-4222-8222-222222222222'
const timestamp = Math.floor(Date.now() / 1000)
const item = {
  id: BigInt(itemId),
  name: '浏览器测试团购：邻里好物',
  description: '这是自动化测试专用数据，不会加入实际页面数据。',
  price: 990,
  stock: 30,
  status: 0,
  owner: 'seller',
  startTime: timestamp - 100,
  endTime: null,
  shipmentCount: 0,
  version: 11,
  categoryId: 1,
}
const order = {
  id: BigInt(orderId),
  itemId: BigInt(itemId),
  user: 'buyer',
  owner: 'seller',
  quantity: 3,
  price: 990,
  total: 1490,
  address: '测试环境专用地址',
  status: 0,
  createTime: timestamp,
  payTime: null as number | null,
  shipTime: null,
  receiptTime: null,
  closeTime: null,
  expiresAt: timestamp + 900,
  refundStatus: 'NONE',
  itemName: item.name,
  itemDescription: item.description,
  snapshotSource: 'AT_CREATION',
  refundedTotal: 0,
}
const lines = [
  {
    itemId: BigInt(itemId),
    quantity: 1,
    price: 990,
    total: 990,
    itemName: item.name,
    itemDescription: '',
    snapshotSource: 'AT_CREATION',
  },
  {
    itemId: 7,
    quantity: 2,
    price: 250,
    total: 500,
    itemName: '另一份测试好物',
    itemDescription: '',
    snapshotSource: 'AT_CREATION',
  },
]
function paged(content: unknown[], page = 0, size = 10) {
  return { content, count: content.length, page, size }
}
async function ok(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: encodeJson({
      success: true,
      code: 'OK',
      message: '',
      data,
      traceId: '0123456789abcdef0123456789abcdef',
    }),
  })
}
async function fail(route: Route, message: string, status: number) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: encodeJson({
      success: false,
      code: 'TEST_ERROR',
      message,
      data: null,
      traceId: '0123456789abcdef0123456789abcdef',
    }),
  })
}
async function backend(page: Page) {
  let userId = 'buyer'
  const currentOrder = { ...order }
  const unhandled: string[] = []
  const authHeaders: (string | undefined)[] = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.slice('/api/v1'.length)
    const method = request.method()
    if (path === '/auth' && method === 'POST') {
      userId = (request.postDataJSON() as { user: string }).user
      return ok(route, {
        token: `test-${userId}`,
        tokenType: 'Bearer',
        expiresAt: timestamp + 3600,
      })
    }
    if (path === '/auth' && method === 'GET') {
      authHeaders.push(request.headers().authorization)
      if (!request.headers().authorization) return fail(route, 'Authentication required', 401)
      return ok(route, {
        id: userId,
        nickname: userId === 'buyer' ? '测试邻里' : userId,
        description: '',
        address: '测试环境专用地址',
        role: userId === 'admin' ? 1 : 0,
      })
    }
    if (path === '/auth/logout') return ok(route, null)
    if (path === '/item') return ok(route, paged([item], Number(url.searchParams.get('page')), 8))
    if (path === `/item/${itemId}` && method === 'GET') return ok(route, item)
    if (path === '/categories') return ok(route, paged([{ id: 1, name: '测试分类' }]))
    if (path === `/item/${itemId}/reviews`) return ok(route, paged([]))
    if (path === '/order') return ok(route, paged([currentOrder]))
    if (path === `/order/${orderId}/details`) return ok(route, { order: currentOrder, lines })
    if (path === `/order/${orderId}/refunds` && method === 'GET') return ok(route, null)
    if (path === '/payments' && method === 'POST')
      return ok(route, {
        id: paymentId,
        orderId: BigInt(orderId),
        amount: 1490,
        merchant: 'test-only',
        channel: 'SIMULATOR',
        status: 'PENDING',
        providerReference: null,
        createTime: timestamp,
        updateTime: timestamp,
      })
    if (path === `/payments/${paymentId}/simulate`) {
      currentOrder.status = 1
      currentOrder.payTime = timestamp
      return ok(route, {
        id: paymentId,
        orderId: BigInt(orderId),
        amount: 1490,
        merchant: 'test-only',
        channel: 'SIMULATOR',
        status: 'SUCCEEDED',
        providerReference: 'test-only',
        createTime: timestamp,
        updateTime: timestamp,
      })
    }
    if (path === `/payments/${paymentId}`)
      return ok(route, {
        id: paymentId,
        orderId: BigInt(orderId),
        amount: 1490,
        merchant: 'test-only',
        channel: 'SIMULATOR',
        status: currentOrder.status ? 'SUCCEEDED' : 'PENDING',
        providerReference: null,
        createTime: timestamp,
        updateTime: timestamp,
      })
    if (path === '/cart') return ok(route, { version: 7, lines: [] })
    unhandled.push(`${method} ${path}`)
    return fail(route, `Unmocked test endpoint ${method} ${path}`, 500)
  })
  return { unhandled, authHeaders, currentOrder }
}
async function login(page: Page, user = 'buyer') {
  await page.goto('/login')
  await page.getByLabel('账号', { exact: true }).fill(user)
  await page.getByLabel('密码', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: '登录，发现好团购' }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('login, protected browsing, exact IDs, responsive layouts and logout', async ({ page }) => {
  const mock = await backend(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true })
  await login(page)
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
  expect(mock.authHeaders).toContain('Bearer test-buyer')
  await page.screenshot({ path: 'test-results/home-contract-test.png', fullPage: true })
  await page.getByRole('link', { name: new RegExp(item.name) }).click()
  await expect(page).toHaveURL(new RegExp(`/items/${itemId}$`))
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.evaluate(() => sessionStorage.getItem('communibuy.token'))).resolves.toBeNull()
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true })
  expect(errors).toEqual([])
  expect(mock.unhandled).toEqual([])
})

test('catalog search, category filters and empty recovery work across screen sizes', async ({
  page,
}) => {
  const mock = await backend(page)
  const queries: URL[] = []
  await page.route('**/api/v1/categories?**', (route) =>
    ok(route, paged([{ id: 1, name: '学习文具' }]))
  )
  await page.route('**/api/v1/item?**', async (route) => {
    const url = new URL(route.request().url())
    queries.push(url)
    return ok(route, paged(url.searchParams.get('keyword') === 'no-results' ? [] : [item]))
  })
  await login(page)
  const search = page.getByRole('search', { name: '搜索社区团购平台' })
  await search.getByRole('textbox', { name: '搜索团购' }).fill('notebook')
  await search.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page).toHaveURL(/\?q=notebook$/)
  await expect.poll(() => queries.at(-1)?.searchParams.get('keyword')).toBe('notebook')
  await page
    .locator('.category-tabs')
    .getByRole('button', { name: '学习文具', exact: true })
    .click()
  await expect.poll(() => queries.at(-1)?.searchParams.get('category')).toBe('1')
  await expect(page.locator('.item-card')).toHaveCount(1)
  await expect(page.locator('.item-card [data-category-art]')).toHaveAttribute(
    'data-category-art',
    'stationery'
  )
  for (const [width, columns] of [
    [1440, 4],
    [1280, 4],
    [1024, 3],
    [768, 3],
    [375, 2],
    [320, 1],
  ]) {
    await page.setViewportSize({ width: width!, height: 900 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
    await expect
      .poll(() =>
        page
          .locator('.product-grid')
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
      )
      .toBe(columns)
  }
  await search.getByRole('textbox', { name: '搜索团购' }).fill('no-results')
  await search.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.getByText('没有找到匹配的团购，试试其他条件')).toBeVisible()
  await page.getByRole('button', { name: '清空搜索', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.item-card')).toHaveCount(1)
  expect(queries.at(-1)?.searchParams.has('keyword')).toBe(false)
  await page.goto(`/items/${itemId}`)
  await expect(page.locator('.detail-art')).toHaveAttribute('data-category-art', 'stationery')
  expect(mock.unhandled).toEqual([])
})

test('normal accounts cannot access admin pages; expiry clears session', async ({ page }) => {
  await backend(page)
  await login(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.getByText('此页面需要相应权限')).toBeVisible()
  await page.route('**/api/v1/order?**', (route) => fail(route, 'Authentication required', 401))
  await page.goto('/orders')
  await expect(page).toHaveURL(/\/login\?.*expired=1/)
  await expect(page.getByText('登录已失效，请重新登录后核对原订单状态')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('communibuy.token'))).toBeNull()
})

test('multi-item totals come from the server and simulator payment keeps buyer permissions', async ({
  page,
}) => {
  const mock = await backend(page)
  await login(page)
  await page.goto(`/orders/${orderId}`)
  await expect(page.locator('.order-line')).toHaveCount(2)
  await expect(page.locator('.price')).toContainText('14.90')
  await page.getByRole('button', { name: '前往模拟支付' }).click()
  await expect(page.getByText('SIMULATOR 模拟渠道 · 非真实支付')).toBeVisible()
  await page.getByRole('button', { name: '确认模拟付款' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click()
  await expect(page.getByRole('heading', { name: '支付成功' })).toBeVisible()
  await page.getByRole('button', { name: '返回订单' }).click()
  await expect(page.getByText('待发货', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认发货' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '取消订单' })).toHaveCount(0)
  expect(mock.unhandled).toEqual([])
})

test('confirmation dialogs stay compact and centered across actions and screen sizes', async ({
  page,
}) => {
  const mock = await backend(page)
  let deletes = 0
  await page.route('**/api/v1/cart', (route) =>
    ok(route, {
      version: 7,
      lines: [
        {
          itemId: BigInt(itemId),
          quantity: 1,
          selected: true,
          name: item.name,
          price: 990,
          stock: 30,
          status: 0,
          startTime: timestamp - 100,
          endTime: null,
        },
      ],
    })
  )
  await page.route(`**/api/v1/cart/${itemId}`, async (route) => {
    deletes++
    await ok(route, { version: 8, lines: [] })
  })
  await login(page)
  await page.goto('/cart')
  for (const width of [1920, 1280, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: '移除', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect
      .poll(async () => {
        const rect = await page.locator('.el-message-box').boundingBox()
        return (
          !!rect &&
          Math.abs(rect.width - Math.min(520, width - 36)) < 2 &&
          Math.abs(rect.x + rect.width / 2 - width / 2) < 2
        )
      })
      .toBe(true)
    if (width === 1280)
      await page.screenshot({
        path: 'test-results/compact-confirm-desktop.png',
        animations: 'disabled',
      })
    if (width === 320)
      await page.screenshot({
        path: 'test-results/compact-confirm-mobile.png',
        animations: 'disabled',
      })
    await dialog.getByRole('button', { name: '返回', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
  expect(deletes).toBe(0)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/orders/${orderId}`)
  await page.getByRole('button', { name: '取消订单', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('确认取消这笔订单？')
  await expect(page.getByRole('dialog')).not.toContainText('退款')
  expect((await page.locator('.el-message-box').boundingBox())!.width).toBeLessThanOrEqual(520)
  await page.getByRole('dialog').getByRole('button', { name: '返回', exact: true }).click()
  expect(mock.unhandled).toEqual([])
})

test('lost checkout response retries original key and version even after refresh', async ({
  page,
}) => {
  await backend(page)
  let checkedOut = false
  const calls: { key: string | undefined; body: string | null }[] = []
  const cart = {
    version: 7,
    lines: [
      {
        itemId: BigInt(itemId),
        quantity: 1,
        selected: true,
        name: item.name,
        price: 990,
        stock: 30,
        status: 0,
        startTime: timestamp - 100,
        endTime: null,
      },
    ],
  }
  await page.route('**/api/v1/cart', (route) =>
    ok(route, checkedOut ? { version: 8, lines: [] } : cart)
  )
  await page.route('**/api/v1/checkout', async (route) => {
    calls.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postData(),
    })
    if (!checkedOut) {
      checkedOut = true
      await route.abort('failed')
      return
    }
    await ok(route, {
      id: checkoutId,
      total: 990,
      orders: [{ order: { ...order, quantity: 1, total: 990 }, lines: [lines[0]] }],
    })
  })
  await page.route(`**/api/v1/checkout/${checkoutId}`, (route) =>
    ok(route, {
      id: checkoutId,
      total: 990,
      orders: [{ order: { ...order, quantity: 1, total: 990 }, lines: [lines[0]] }],
    })
  )
  await login(page)
  await page.goto('/cart')
  await page.getByRole('button', { name: '确认并创建订单' }).click()
  await expect(page.getByRole('button', { name: '使用原请求重试结算' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('购物车还是空的')).toHaveCount(0)
  await page.getByRole('button', { name: '使用原请求重试结算' }).click()
  await expect(page).toHaveURL(new RegExp(`/checkouts/${checkoutId}$`))
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
  expect(calls[0]?.body).toContain('"cartVersion":7')
})

test('stock version conflicts require a new read and explicit review', async ({ page }) => {
  await backend(page)
  let writes = 0
  let latest = false
  const versions: unknown[] = []
  await page.route(`**/api/v1/item/${itemId}`, async (route) => {
    if (route.request().method() === 'GET') {
      await ok(route, latest ? { ...item, version: 12, stock: 29 } : item)
      return
    }
    const body = route.request().postDataJSON() as { version: number; stock: number }
    versions.push(body.version)
    writes++
    if (writes === 1) {
      latest = true
      await fail(route, 'Supply the current item version when changing stock', 409)
      return
    }
    await ok(route, { ...item, version: 13, stock: body.stock })
  })
  await login(page, 'seller')
  await page.goto(`/seller/items/${itemId}/edit`)
  await expect(page.getByLabel('团购名称', { exact: true })).toHaveValue(item.name)
  await page.getByRole('button', { name: '保存团购' }).click()
  await expect(page.getByRole('button', { name: '重新读取商品' })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存团购' })).toBeDisabled()
  await page.getByRole('button', { name: '重新读取商品' }).click()
  await expect(page.getByRole('button', { name: '保存团购' })).toBeEnabled()
  await page.getByRole('button', { name: '保存团购' }).click()
  await expect(page).toHaveURL(/\/seller\/items$/)
  expect(versions).toEqual([11, 12])
})

test('admin dashboard, protected lists, profile whitelist and negative settlement', async ({
  page,
}) => {
  const mock = await backend(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/v1/stats', (route) =>
    ok(route, {
      userCount: 2,
      itemCount: 1,
      orderCount: 1,
      ongoingItemCount: 1,
      totalRevenue: 9007199254740993n,
      grossPaidAmount: 9007199254740993n,
      refundAmount: 100,
      netPaidAmount: 9007199254740893n,
      unreconciledPaidOrderCount: 0,
    })
  )
  await page.route('**/api/v1/user?**', (route) => ok(route, paged(['buyer', 'admin'])))
  await page.route('**/api/v1/user/*', (route) =>
    ok(route, {
      id: route.request().url().endsWith('/admin') ? 'admin' : 'buyer',
      nickname: '测试账号',
      description: '',
      address: '',
      role: route.request().url().endsWith('/admin') ? 1 : 0,
    })
  )
  await page.route('**/api/v1/audit?**', (route) =>
    ok(
      route,
      paged([
        {
          id: 1,
          createTime: timestamp,
          traceId: 'test-audit',
          actorHash: 'redacted',
          resourceHash: 'redacted',
          action: 'TEST_ONLY',
          outcome: 'SUCCESS',
          httpStatus: 200,
        },
      ])
    )
  )
  const settlementId = '33333333-3333-4333-8333-333333333333'
  await page.route(`**/api/v1/settlements/${settlementId}`, (route) =>
    ok(route, {
      id: settlementId,
      seller: 'admin',
      netAmount: -700,
      createTime: timestamp,
      entries: [{ id: 1, orderId: BigInt(orderId), refundId: null, kind: 'REFUND', amount: -700 }],
    })
  )
  await login(page, 'admin')
  await page.goto('/admin')
  await expect(page.getByText('90,071,992,547,409.93', { exact: false }).first()).toBeVisible()
  await expect(page.locator('[role="img"][aria-label^="平台对象数量"] svg')).toBeVisible()
  for (const section of ['users', 'categories', 'items', 'orders', 'audit']) {
    await page.goto(`/admin/${section}`)
    await expect(page.locator('.el-table__body tr').first()).toBeVisible()
  }
  await page.goto(`/settlements/${settlementId}`)
  await expect(page.locator('.price')).toContainText('-7.00')
  await expect(page.getByText('负数净额表示需要扣回的账款，不是新增收入。')).toBeVisible()
  let submitted: unknown = null
  await page.route('**/api/v1/user/admin', async (route) => {
    submitted = route.request().postDataJSON()
    await ok(route, {
      id: 'admin',
      nickname: '新的测试昵称',
      description: '',
      address: '测试环境专用地址',
      role: 1,
    })
  })
  await page.goto('/profile')
  await page.getByLabel('昵称', { exact: true }).fill('新的测试昵称')
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('个人资料已保存')).toBeVisible()
  expect(submitted).toEqual({ nickname: '新的测试昵称' })
  expect(errors).toEqual([])
  expect(mock.unhandled).toEqual([])
})

test('direct purchase retains exact Long ID and original key on retry', async ({ page }) => {
  await backend(page)
  const calls: { body: string | null; key: string | undefined }[] = []
  await page.route('**/api/v1/order', async (route) => {
    calls.push({
      body: route.request().postData(),
      key: route.request().headers()['idempotency-key'],
    })
    if (calls.length === 1) {
      await route.abort('failed')
      return
    }
    await ok(route, order)
  })
  await login(page)
  await page.goto(`/items/${itemId}`)
  await page.getByRole('spinbutton').fill('2')
  await page.getByLabel('本次订单收货地址').fill('第二个测试地址')
  await page.getByRole('button', { name: '立即购买', exact: true }).click()
  await expect(page.getByRole('button', { name: '使用原请求重试', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('spinbutton')).toHaveValue('2')
  await expect(page.getByLabel('本次订单收货地址')).toHaveValue('第二个测试地址')
  await page.getByRole('button', { name: '使用原请求重试', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`))
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
  expect(calls[0]?.body).toContain(`"itemId":${itemId}`)
  expect(calls[0]?.body).not.toContain('"price"')
  expect(calls[0]?.body).not.toContain('"user"')
})

test('refund approval and failed retries remain seller or admin only', async ({ page }) => {
  await backend(page)
  const refundId = '44444444-4444-4444-8444-444444444444'
  let status = 'REQUESTED'
  const attempts: string[] = []
  const record = () => ({
    id: refundId,
    orderId: BigInt(orderId),
    paymentId,
    amount: 1490,
    reason: '测试售后原因',
    status,
    attempts: 1,
    providerReference: null,
    createTime: timestamp,
    updateTime: timestamp,
  })
  await page.route(`**/api/v1/refunds/${refundId}`, (route) => ok(route, record()))
  await page.route(`**/api/v1/refunds/${refundId}/retry`, async (route) => {
    attempts.push(route.request().url())
    status = 'SUCCEEDED'
    await ok(route, record())
  })
  await login(page)
  await page.goto(`/refunds/${refundId}`)
  await expect(page.getByText('等待审核', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '批准退款' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '拒绝申请' })).toHaveCount(0)
  status = 'FAILED'
  await login(page, 'seller')
  await page.goto(`/refunds/${refundId}`)
  await page.getByRole('button', { name: '重试这笔退款' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click()
  await expect(page.getByText('退款成功', { exact: true })).toBeVisible()
  expect(attempts).toHaveLength(1)
  expect(attempts[0]).toMatch(new RegExp(`/refunds/${refundId}/retry$`))
})
