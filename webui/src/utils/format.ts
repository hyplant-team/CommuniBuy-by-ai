export function money(cents: string | bigint | number): string {
  if (typeof cents === 'number' && !Number.isSafeInteger(cents))
    throw new Error('金额必须是精确的整数分')
  const value = BigInt(cents)
  const positive = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${(positive / 100n).toLocaleString('zh-CN')}.${(positive % 100n).toString().padStart(2, '0')}`
}
export function priceToCents(input: string): number {
  const text = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('价格请输入非负金额，最多两位小数')
  const [whole = '0', fraction = ''] = text.split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents > 2147483647n) throw new Error('价格超出接口允许范围')
  return Number(cents)
}
export function dateTime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.valueOf())
    ? '时间超出显示范围'
    : date.toLocaleString('zh-CN', { hour12: false })
}
export function saleState(
  item: { status: number; stock: number; startTime: number; endTime: number | null },
  now = Date.now() / 1000
): string {
  if (item.status === -1) return '已下架'
  if (now < item.startTime) return '即将开始'
  if (item.endTime !== null && now >= item.endTime) return '已结束'
  return item.stock > 0 ? '正在团购' : '暂时售罄'
}
export const orderLabels: Record<number, string> = {
  '-1': '已关闭',
  0: '待支付',
  1: '待发货',
  2: '待收货',
  3: '已完成',
}
export const refundLabels: Record<string, string> = {
  REQUESTED: '待审核',
  APPROVED: '退款处理中',
  FAILED: '退款失败',
  SUCCEEDED: '已退款',
  REJECTED: '已拒绝',
}
export function pageCount(count: string): number {
  const n = Number(count)
  return Number.isSafeInteger(n) && n >= 0 ? n : 0
}
export function validUserId(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(value)
}
export function validatePassword(value: string, isNew = true): string {
  if (!value.trim()) return '请输入密码'
  if ((isNew && value.length < 8) || value.length > 72)
    return isNew ? '密码长度应为 8～72 个字符' : '密码最多 72 个字符'
  if (new TextEncoder().encode(value).length > 72) return '密码的 UTF-8 长度不能超过 72 字节'
  return ''
}
export function requireText(value: string, label: string, max: number, pure = true): void {
  if (!value.trim() || value.length > max) throw new Error(`${label}不能为空，且最多 ${max} 个字符`)
  if (pure && /[<>]/.test(value)) throw new Error(`${label}请使用纯文本，不含尖括号`)
}
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\u0000-\u0020]/.test(value) &&
    !/^\/(login|register)([?#/]|$)/.test(value)
    ? value
    : '/'
}
