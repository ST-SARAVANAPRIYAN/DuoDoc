/**
 * Document Library, Custom Folders, and Authentication API Client
 */

const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('documind_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

// --- AUTHENTICATION ---

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function register(data) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Registration failed');
  }
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load user profile');
  return res.json();
}

export async function switchRole(role) {
  const res = await fetch(`${API_BASE}/auth/switch-role`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role })
  });
  if (!res.ok) throw new Error('Role switch failed');
  return res.json();
}

// --- FOLDERS ---

export async function getFolders() {
  const res = await fetch(`${API_BASE}/library/folders`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

export async function createFolder({ name, color, icon, description }) {
  const res = await fetch(`${API_BASE}/library/folders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, color, icon, description })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create folder');
  }
  return res.json();
}

export async function deleteFolder(folderId) {
  const res = await fetch(`${API_BASE}/library/folders/${folderId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete folder');
  return res.json();
}

// --- DOCUMENTS ---

export async function getDocuments({ folderId = 'all', search = '', fileType = 'all' } = {}) {
  const params = new URLSearchParams();
  if (folderId && folderId !== 'all') params.append('folder_id', folderId);
  if (search) params.append('search', search);
  if (fileType && fileType !== 'all') params.append('file_type', fileType);

  const res = await fetch(`${API_BASE}/library/documents?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(file, { folderId, title } = {}) {
  const token = localStorage.getItem('documind_token');
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folder_id', folderId);
  if (title) formData.append('title', title);

  const res = await fetch(`${API_BASE}/library/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function moveDocument(documentId, folderId) {
  const res = await fetch(`${API_BASE}/library/documents/${documentId}/move`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ folder_id: folderId })
  });
  if (!res.ok) throw new Error('Failed to move document');
  return res.json();
}

export async function deleteDocument(documentId) {
  const res = await fetch(`${API_BASE}/library/documents/${documentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export async function createBlankDocument(title = 'Untitled Document', folderId = null) {
  const res = await fetch(`${API_BASE}/library/create-blank`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, folder_id: folderId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create new document');
  }
  return res.json();
}

export async function updateDocument(documentId, { title, tags }) {
  const res = await fetch(`${API_BASE}/library/documents/${documentId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, tags })
  });
  if (!res.ok) throw new Error('Failed to update document');
  return res.json();
}

// --- CHAT SESSION HISTORY ---

export async function getChatHistory(documentId) {
  const res = await fetch(`${API_BASE}/library/documents/${documentId}/chat`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return { messages: [] };
  return res.json();
}

export async function saveChatMessage(documentId, msgData) {
  const res = await fetch(`${API_BASE}/library/documents/${documentId}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(msgData)
  });
  if (!res.ok) return { status: 'failed' };
  return res.json();
}
