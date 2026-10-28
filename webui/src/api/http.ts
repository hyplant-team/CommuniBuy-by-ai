import axios from 'axios'
import type { Envelope } from '../types/api'
import { encodeJson, parseApiJson } from '../utils/json'
import { serverErrorMessage } from '../utils/apiMessages'

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public traceId = '',
    public retryAfter: string | null = null
  ) {
    super(message)
  }
}
const tokenKey = 'communibuy.token'
export const tokenStorage = {
  get: () => sessionStorage.getItem(tokenKey),
  set: (token: string) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey),
}
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  transformResponse: [
    (data) => {
      if (typeof data !== 'string' || !data) return data
      try {
        return parseApiJson(data)
      } catch {
        return data
      }
    },
  ],
  transformRequest: [(data) => (data === undefined ? undefined : encodeJson(data))],
})
http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  const publicAuth =
    config.method?.toLowerCase() === 'post' &&
    ['/auth', '/auth/register'].includes(config.url || '')
  if (token && !publicAuth) config.headers.set('Authorization', `Bearer ${token}`)
  if (config.data !== undefined) config.headers.set('Content-Type', 'application/json')
  return config
})
function connectionErrorMessage(method: string, url: string): string {
  const action = method.toUpperCase()
  if (action === 'POST' && url === '/auth') return '暂时无法连接登录服务，请检查连接后重试。'
  if (action === 'POST' && url === '/auth/register')
    return '暂时无法连接注册服务，请检查连接后重试。'
  if (action === 'GET' && url === '/auth') return '暂时无法验证登录状态，请检查连接后重试。'
  if (action === 'POST' && url === '/order')
    return '订单提交结果尚未确认，请先核对订单；如需重试，请沿用原请求。'
  if (action === 'POST' && url === '/checkout')
    return '结算结果尚未确认，请先核对订单；如需重试，请沿用原请求。'
  if (action === 'GET' || action === 'HEAD') return '暂时无法加载数据，请检查连接后重试。'
  return '暂时无法连接服务，请检查连接后重试。'
}
const backoff = new Map<string, number>()
export async function request<T>(
  method: string,
  url: string,
  data?: unknown,
  params?: object,
  key?: string
): Promise<T> {
  const endpoint = `${tokenStorage.get() || 'guest'}:${method}:${url}`
  const delay = Math.ceil(((backoff.get(endpoint) || 0) - Date.now()) / 1000)
  if (delay > 0) throw new ApiError('操作过于频繁', 429, '', String(delay))
  try {
    const response = await http.request<Envelope<T>>({
      method,
      url,
      data,
      params,
      headers: key ? { 'Idempotency-Key': key } : undefined,
    })
    const body = response.data
    if (!body || typeof body.success !== 'boolean')
      throw new ApiError('服务响应格式不匹配，请核对后端版本与代理地址')
    if (!body.success)
      throw new ApiError(
        serverErrorMessage(body.message, method, url) || '操作未完成',
        response.status,
        body.traceId
      )
    return body.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (axios.isAxiosError<Envelope<unknown>>(error)) {
      const status = error.response?.status || 0
      const publicAuth =
        method.toUpperCase() === 'POST' && ['/auth', '/auth/register'].includes(url)
      if (status === 401 && !publicAuth) {
        tokenStorage.clear()
        window.dispatchEvent(new Event('communibuy:unauthorized'))
      }
      const body = error.response?.data
      if (status === 429) {
        const value = String(error.response?.headers['retry-after'] || '')
        const until = /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : Date.parse(value)
        if (Number.isFinite(until)) backoff.set(endpoint, until)
      }
      const message =
        serverErrorMessage(body?.message, method, url) ||
        (status === 429
          ? '操作过于频繁，请按提示稍后重试'
          : status
            ? `请求失败（${status}），请核对服务配置`
            : connectionErrorMessage(method, url))
      throw new ApiError(
        message,
        status,
        body?.traceId || String(error.response?.headers['x-trace-id'] || ''),
        error.response?.headers['retry-after']
          ? String(error.response.headers['retry-after'])
          : null
      )
    }
    throw error
  }
}
