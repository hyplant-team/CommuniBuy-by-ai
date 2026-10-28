import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { http, request, tokenStorage } from '../../src/api/http'
import { errorText } from '../../src/composables/useTask'
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
  vi.stubGlobal('window', new EventTarget())
})
describe('HTTP contract', () => {
  it('sends Bearer on GET /auth but not POST /auth and parses exact IDs', async () => {
    tokenStorage.set('test-token')
    const calls: { method: string | undefined; authorization: unknown }[] = []
    const adapter: AxiosAdapter = async (config) => {
      calls.push({ method: config.method, authorization: config.headers.get('Authorization') })
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '{"success":true,"code":"OK","data":{"id":9223372036854775807},"traceId":"test"}',
      }
    }
    http.defaults.adapter = adapter
    expect(await request('GET', '/auth')).toEqual({ id: '9223372036854775807' })
    await request('POST', '/auth', { user: 'buyer', password: 'test-only' })
    expect(calls[0]?.authorization).toBe('Bearer test-token')
    expect(calls[1]?.authorization).toBeUndefined()
  })
  it('clears an expired token and emits auth invalidation', async () => {
    tokenStorage.set('expired-token')
    const expired = vi.fn()
    window.addEventListener('communibuy:unauthorized', expired)
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        data: '{"success":false,"message":"Authentication required","traceId":"trace1"}',
      })
    }
    await expect(request('GET', '/auth')).rejects.toMatchObject({ status: 401, traceId: 'trace1' })
    expect(tokenStorage.get()).toBeNull()
    expect(expired).toHaveBeenCalledOnce()
  })
  it('honors Retry-After without sending another write', async () => {
    let count = 0
    http.defaults.adapter = async (config) => {
      count++
      throw new AxiosError('Rate limited', 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 429,
        statusText: 'Too Many Requests',
        headers: AxiosHeaders.from({ 'retry-after': '30' }),
        data: '{"success":false,"message":"Rate limited","traceId":"trace2"}',
      })
    }
    await expect(request('POST', '/rate-test', {})).rejects.toMatchObject({ status: 429 })
    const waiting = await request('POST', '/rate-test', {}).catch((error: unknown) => error)
    expect(waiting).toMatchObject({ status: 429 })
    expect(errorText(waiting)).toBe('操作过于频繁（请在 30 秒后重试）')
    expect(count).toBe(1)
  })
  it('reports a proxy HTML fallback as a contract mismatch', async () => {
    http.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '<html>wrong server</html>',
    })
    await expect(request('GET', '/item')).rejects.toThrow('服务响应格式不匹配')
  })
  it('preserves a specific backend login error and its trace without invalidating another session', async () => {
    tokenStorage.set('existing-token')
    const expired = vi.fn()
    window.addEventListener('communibuy:unauthorized', expired)
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        data: JSON.stringify({
          success: false,
          message: '密码错误，请重新输入',
          traceId: 'login-trace',
        }),
      })
    }
    await expect(
      request('POST', '/auth', { user: 'buyer', password: 'test-only' })
    ).rejects.toMatchObject({
      message: '密码错误，请重新输入',
      status: 401,
      traceId: 'login-trace',
    })
    expect(tokenStorage.get()).toBe('existing-token')
    expect(expired).not.toHaveBeenCalled()
  })
  it('does not invent a password-only cause for unified invalid credentials', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        data: JSON.stringify({
          success: false,
          message: 'Invalid credentials',
          traceId: 'unified',
        }),
      })
    }
    await expect(request('POST', '/auth', {})).rejects.toMatchObject({
      message: '登录失败：账号或密码错误，或账号已被停用。',
      traceId: 'unified',
    })
  })
  it('preserves business errors in a successful HTTP envelope instead of showing a network error', async () => {
    http.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: JSON.stringify({
        success: false,
        message: '该订单已申请售后',
        traceId: 'refund-trace',
      }),
    })
    await expect(
      request('POST', '/order/123/refunds', { reason: 'test-only' })
    ).rejects.toMatchObject({
      message: '该订单已申请售后',
      traceId: 'refund-trace',
    })
  })
  it.each([
    ['POST', '/auth', '登录服务'],
    ['POST', '/auth/register', '注册服务'],
    ['GET', '/auth', '验证登录状态'],
    ['GET', '/item', '加载数据'],
    ['POST', '/order', '订单提交结果尚未确认'],
    ['POST', '/checkout', '结算结果尚未确认'],
    ['PUT', '/cart/1', '暂时无法连接服务'],
  ])('uses a contextual connection error for %s %s without retrying', async (method, url, text) => {
    const calls: unknown[] = []
    tokenStorage.set('network-test-token')
    http.defaults.adapter = async (config) => {
      calls.push(config)
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    await expect(request(method, url, undefined, undefined, 'original-key')).rejects.toThrow(text)
    expect(calls).toHaveLength(1)
    expect(tokenStorage.get()).toBe('network-test-token')
  })
})
