import { adminHeaders, apiBase } from '@/lib/utils'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...adminHeaders(),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  dograhStatus: () => request('/api/dograh/status'),
  dograhTest: () =>
    request('/api/dograh/test-connection', { method: 'POST', body: '{}' }),
  settings: () => request('/api/settings'),
  updateSettings: (body: Record<string, unknown>) =>
    request('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  avatars: () => request('/api/avatars'),
  avatarEngines: () => request('/api/avatars/engines'),
  createAvatar: (body: Record<string, unknown>) =>
    request('/api/avatars/create', { method: 'POST', body: JSON.stringify(body) }),
  updateAvatar: (id: string, body: Record<string, unknown>) =>
    request(`/api/avatars/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAvatar: (id: string) =>
    request(`/api/avatars/${id}`, { method: 'DELETE' }),
  uploadAvatar: async (file: File, kind: string, avatarId?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    if (avatarId) fd.append('avatar_id', avatarId)
    return request('/api/avatars/upload', { method: 'POST', body: fd, headers: adminHeaders() })
  },
  startSession: (body: Record<string, unknown> = {}) =>
    request('/api/sessions/start', { method: 'POST', body: JSON.stringify(body) }),
  stopSession: (sessionId: string) =>
    request(`/api/sessions/stop?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: '{}',
    }),
  diagnostics: () => request('/api/diagnostics'),
}
