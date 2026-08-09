const API_BASE = ''

let authToken: string | null = null

export function setToken(token: string | null) {
  authToken = token
}

export function getToken() {
  return authToken
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (authToken) {
    headers['Authorization'] = `JWT ${authToken}`
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.errors?.[0]?.message || err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// Auth
export async function login(email: string, password: string) {
  const data = await request('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (data.token) setToken(data.token)
  return data
}

export async function logout() {
  setToken(null)
}

// CRUD helpers
export async function getList(collection: string, params?: Record<string, string>) {
  const qs = new URLSearchParams(params || {}).toString()
  return request(`/api/${collection}${qs ? '?' + qs : ''}`)
}

export async function getOne(collection: string, id: string | number) {
  return request(`/api/${collection}/${id}`)
}

export async function create(collection: string, data: Record<string, unknown>) {
  return request(`/api/${collection}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function update(collection: string, id: string | number, data: Record<string, unknown>) {
  return request(`/api/${collection}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function remove(collection: string, id: string | number) {
  return request(`/api/${collection}/${id}`, { method: 'DELETE' })
}

// File upload (FormData, no JSON content-type)
export async function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const headers: Record<string, string> = {}
  if (authToken) headers['Authorization'] = `JWT ${authToken}`
  const res = await fetch(`/api/media`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error('文件上传失败')
  return res.json()
}
