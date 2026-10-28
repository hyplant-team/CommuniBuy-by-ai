import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ApiError } from '../api/http'
export function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : '操作失败，请稍后重试'
  return error instanceof ApiError
    ? `${text}${error.retryAfter && /^\d+$/.test(error.retryAfter) ? `（请在 ${error.retryAfter} 秒后重试）` : ''}`
    : text
}
export function useTask() {
  const busy = ref(false)
  const error = ref('')
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    if (busy.value) return undefined
    busy.value = true
    error.value = ''
    try {
      const result = await fn()
      if (success) ElMessage.success(success)
      return result
    } catch (e) {
      error.value = errorText(e)
      return undefined
    } finally {
      busy.value = false
    }
  }
  return { busy, error, run }
}
