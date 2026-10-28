import { describe, expect, it } from 'vitest'
import { ApiError } from '../../src/api/http'
import { errorText } from '../../src/composables/useTask'

describe('user-facing error feedback', () => {
  it('shows the reason without exposing the diagnostic identifier', () => {
    const error = new ApiError('密码错误，请重新输入', 401, 'internal-trace')
    expect(errorText(error)).toBe('密码错误，请重新输入')
    expect(error.traceId).toBe('internal-trace')
  })
  it('expresses a numeric retry delay in Chinese', () => {
    expect(errorText(new ApiError('操作过于频繁', 429, 'trace', '30'))).toBe(
      '操作过于频繁（请在 30 秒后重试）'
    )
  })
  it('keeps plain errors readable without adding a raw HTTP-date header', () => {
    expect(errorText(new Error('请填写售后原因'))).toBe('请填写售后原因')
    expect(
      errorText(
        new ApiError('操作过于频繁，请稍后重试', 429, 'trace', 'Wed, 28 Oct 2026 01:00:00 GMT')
      )
    ).toBe('操作过于频繁，请稍后重试')
  })
})
