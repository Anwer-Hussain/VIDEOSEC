const TOKEN_KEY = 'videosec_token'
const USER_KEY = 'videosec_user'
const DEVICE_KEY = 'videosec_device_id'

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function getDeviceName() {
  const ua = navigator.userAgent
  let os = 'Unknown Device'
  if (ua.includes('Win')) os = 'Windows PC'
  else if (ua.includes('Mac')) os = 'Mac'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android Phone'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'Apple iOS'

  let browser = 'Browser'
  if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'

  return `${os} • ${browser}`
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent('auth:change'))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new CustomEvent('auth:change'))
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function getUserAvatar(userId) {
  if (!userId) return null
  return localStorage.getItem(`videosec_avatar_${userId}`) || null
}

export function saveUserAvatar(userId, avatarDataUrl) {
  if (!userId) return
  if (avatarDataUrl) {
    localStorage.setItem(`videosec_avatar_${userId}`, avatarDataUrl)
  } else {
    localStorage.removeItem(`videosec_avatar_${userId}`)
  }
  window.dispatchEvent(new CustomEvent('auth:change'))
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = options.headers || {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const deviceId = getOrCreateDeviceId()
  if (deviceId) headers['X-Device-Id'] = deviceId
  headers['X-Device-Name'] = encodeURIComponent(getDeviceName())
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(options.json)
  }

  const res = await fetch(`/api${path}`, { ...options, headers })

  if (!res.ok) {
    if (res.status === 401) {
      clearSession()
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data.error) message = data.error
    } catch {
      /* ignore non-JSON error body */
    }
    throw new Error(message)
  }
  return res
}

export const api = {
  register: (username, email, password) =>
    request('/auth/register', {
      method: 'POST',
      json: {
        username,
        email,
        password,
        device_id: getOrCreateDeviceId(),
        device_name: getDeviceName(),
      },
    }).then((r) => r.json()),

  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      json: {
        username,
        password,
        device_id: getOrCreateDeviceId(),
        device_name: getDeviceName(),
      },
    }).then((r) => r.json()),

  verifyOtp: (tempToken, otp, trustDevice = true) =>
    request('/auth/verify-otp', {
      method: 'POST',
      json: {
        temp_token: tempToken,
        otp,
        trust_device: trustDevice,
        device_id: getOrCreateDeviceId(),
        device_name: getDeviceName(),
      },
    }).then((r) => r.json()),

  resendOtp: (tempToken) =>
    request('/auth/resend-otp', {
      method: 'POST',
      json: {
        temp_token: tempToken,
        device_name: getDeviceName(),
      },
    }).then((r) => r.json()),

  listDevices: () => request('/auth/devices').then((r) => r.json()),

  revokeDevice: (deviceId) =>
    request(`/auth/devices/${deviceId}`, { method: 'DELETE' }).then((r) => r.json()),

  getSecurityLogs: () => request('/auth/security-logs').then((r) => r.json()),


  listVideos: () => request('/videos').then((r) => r.json()),

  listEncryptedFiles: () => request('/files').then((r) => r.json()),

  uploadEncryptedFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request('/files/upload', { method: 'POST', body: formData }).then((r) => r.json())
  },

  downloadEncryptedFile: async (id, filename, confirmPassword) => {
    const res = await request(`/files/${id}/download`, {
      method: 'POST',
      json: { password: confirmPassword },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  },

  deleteEncryptedFile: (id) => request(`/files/${id}`, { method: 'DELETE' }).then((r) => r.json()),

  createEncryptedFileShare: (id, data) =>
    request(`/files/${id}/share`, { method: 'POST', json: data }).then((r) => r.json()),

  listMyEncryptedFileShares: () => request('/files/my-shares').then((r) => r.json()),

  listReceivedEncryptedFileShares: () => request('/files/shared-with-me').then((r) => r.json()),

  revokeEncryptedFileShare: (shareId) =>
    request(`/files/shares/${shareId}`, { method: 'DELETE' }).then((r) => r.json()),

  updateEncryptedFileShare: (shareId, data) =>
    request(`/files/shares/${shareId}`, { method: 'PATCH', json: data }).then((r) => r.json()),

  getEncryptedFileShareInfo: (token) =>
    request(`/files/share/${token}/info`).then((r) => r.json()),

  viewEncryptedFileShare: async (token, pin = '') => {
    const res = await request(`/files/share/${token}/view`, {
      method: 'POST',
      json: { pin },
    })
    return {
      blob: await res.blob(),
      mimetype: res.headers.get('Content-Type') || 'application/octet-stream',
      viewCount: Number(res.headers.get('X-Share-View-Count') || 0),
    }
  },

  downloadEncryptedFileShare: async (token, pin = '', filename = 'shared-file') => {
    const res = await request(`/files/share/${token}/download`, {
      method: 'POST',
      json: { pin },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
    return Number(res.headers.get('X-Share-View-Count') || 0)
  },

  uploadVideo: (file, onProgress) => {
    // Using XHR here (instead of fetch) so we can report upload progress.
    return new Promise((resolve, reject) => {
      const token = getToken()
      if (!token) {
        clearSession()
        window.dispatchEvent(new CustomEvent('auth:expired'))
        reject(new Error('Authentication required. Please log in first.'))
        return
      }

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/videos/upload')
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data)
          } else {
            if (xhr.status === 401) {
              clearSession()
              window.dispatchEvent(new CustomEvent('auth:expired'))
            }
            reject(new Error(data.error || 'Upload failed'))
          }
        } catch {
          if (xhr.status === 401) {
            clearSession()
            window.dispatchEvent(new CustomEvent('auth:expired'))
            reject(new Error('Session expired or unauthorized. Please log in again.'))
          } else {
            reject(new Error(`Upload failed (${xhr.status || 'server error'})`))
          }
        }
      }
      xhr.onerror = () => {
        if (xhr.status === 401) {
          clearSession()
          window.dispatchEvent(new CustomEvent('auth:expired'))
          reject(new Error('Session expired or unauthorized. Please log in again.'))
        } else {
          reject(new Error('Upload failed. Check your network or log in again.'))
        }
      }

      const formData = new FormData()
      formData.append('file', file)
      xhr.send(formData)
    })
  },

  downloadVideo: async (id, filename, confirmPassword = '') => {
    const res = await request(`/videos/${id}/download`, {
      method: 'POST',
      headers: {
        'X-Confirm-Password': confirmPassword,
      },
      json: { password: confirmPassword },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  // Decrypts the video into memory and hands back a blob: URL for a
  // <video> player. Nothing is saved to disk - the caller should
  // revokeObjectURL() when the player closes.
  viewVideo: async (id) => {
    const res = await request(`/videos/${id}/view`)
    const blob = await res.blob()
    return window.URL.createObjectURL(blob)
  },

  // Downloads the video exactly as stored - still AES-256 encrypted,
  // zipped up. No decryption happens for this one.
  downloadEncryptedZip: async (id, filename) => {
    const res = await request(`/videos/${id}/download-encrypted`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const stem = filename.replace(/\.[^/.]+$/, '')
    const a = document.createElement('a')
    a.href = url
    a.download = `${stem}_encrypted.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  deleteVideo: (id) => request(`/videos/${id}`, { method: 'DELETE' }).then((r) => r.json()),

  // --- Secure Sharing APIs ---
  createShare: (id, data) =>
    request(`/videos/${id}/share`, { method: 'POST', json: data }).then((r) => r.json()),

  listSharedWithMe: () => request('/videos/shared-with-me').then((r) => r.json()),

  listMyShares: () => request('/videos/my-shares').then((r) => r.json()),

  revokeShare: (shareId) =>
    request(`/videos/shares/${shareId}`, { method: 'DELETE' }).then((r) => r.json()),

  updateShare: (shareId, data) =>
    request(`/videos/shares/${shareId}`, { method: 'PATCH', json: data }).then((r) => r.json()),


  getShareInfo: (token) =>
    request(`/videos/share/${token}/info`).then((r) => r.json()),

  viewSharedVideo: async (token, pin = '') => {
    const res = await request(`/videos/share/${token}/view`, {
      method: 'POST',
      json: { pin },
    })
    const blob = await res.blob()
    return {
      url: window.URL.createObjectURL(blob),
      forensicIP: res.headers.get('X-Forensic-IP') || '127.0.0.1',
      forensicTimestamp: res.headers.get('X-Forensic-Timestamp') || new Date().toISOString(),
    }
  },

  downloadSharedVideo: async (token, pin = '', filename = 'video.mp4') => {
    const res = await request(`/videos/share/${token}/download`, {
      method: 'POST',
      json: { pin },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  // --- Portable (.vsec) Container Crypto ---
  exportVsec: async (id, pin, filename) => {
    const res = await request(`/videos/${id}/export-vsec`, {
      method: 'POST',
      json: { pin },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const stem = filename.replace(/\.[^/.]+$/, '')
    const a = document.createElement('a')
    a.href = url
    a.download = `${stem}.vsec`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  unlockVsec: async (file, pin, action = 'stream') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pin', pin)
    formData.append('action', action)

    const res = await fetch('/api/videos/unlock-vsec', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      let message = 'Unlock failed'
      try {
        const data = await res.json()
        if (data.error) message = data.error
      } catch {}
      throw new Error(message)
    }

    const blob = await res.blob()
    if (action === 'download') {
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^";]+)"?/)
      const filename = match ? match[1] : 'decrypted_video.mp4'
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      return { downloaded: true, filename }
    }

    return {
      url: window.URL.createObjectURL(blob),
      forensicIP: res.headers.get('X-Forensic-IP') || '127.0.0.1',
      forensicTimestamp: res.headers.get('X-Forensic-Timestamp') || new Date().toISOString(),
    }
  },

  getClientInfo: () =>
    request('/videos/client-info')
      .then((r) => r.json())
      .catch(() => ({ ip: '127.0.0.1', timestamp: new Date().toISOString() })),
}
