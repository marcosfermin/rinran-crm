export function apiFetch(url, options = {}) {
  const token = localStorage.getItem('rinran_token');
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('rinran_token');
      window.location.reload();
      return null;
    }
    return res;
  });
}
