/**
 * ONLYOFFICE Document Server API Client
 */

const BASE_URL = 'http://localhost:8000';

export async function fetchOnlyOfficeConfig(documentId) {
  const res = await fetch(`${BASE_URL}/api/onlyoffice/config/${documentId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch ONLYOFFICE config (${res.status})`);
  }
  return await res.json();
}
