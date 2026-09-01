export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    window.location.assign('/login')
    throw new ApiError(401, '会话已过期')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.detail || `请求失败 (${response.status})`)
  }
  return response.json() as Promise<T>
}
