const messages: Record<string, string> = {
  'Authentication required': '请先登录，或重新登录后再操作。',
  'Access denied': '当前账号没有执行此操作的权限。',
  'Resource not found': '请求的记录不存在，请刷新后核对。',
  'Invalid request': '提交的信息不符合要求，请检查填写内容。',
  'Data conflict; refresh and retry': '数据已发生变化，请刷新并核对后重试。',
  'Internal server error': '服务暂时出现异常，请稍后重试。',
  'Method not allowed': '当前操作不受服务支持，请核对接口版本。',
  'Password exceeds 72 UTF-8 bytes': '密码的 UTF-8 长度不能超过 72 字节。',
}

export function serverErrorMessage(message: unknown, method: string, url: string): string {
  if (typeof message !== 'string' || !message.trim()) return ''
  const text = message.trim()
  if (text === 'Invalid credentials') {
    if (method.toUpperCase() === 'POST' && url === '/auth')
      return '登录失败：账号或密码错误，或账号已被停用。'
    if (method.toUpperCase() === 'POST' && url === '/auth/reset')
      return '原密码验证失败，或登录状态已失效，请核对后重试。'
    return '身份验证失败，请重新登录后重试。'
  }
  // Preserve specific backend business errors, including future Chinese messages.
  return messages[text] || text
}
