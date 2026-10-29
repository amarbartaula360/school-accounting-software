// Shared API helper for authenticated requests.
// Import apiFetch from this file in App.jsx, ExaminationModule.jsx, StudentIdCardModule.jsx,
// and any other frontend module that calls the Express API.
export const AUTH_TOKEN_KEY = 'ledgerpro_access_token';

export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
