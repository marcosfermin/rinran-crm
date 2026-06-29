import { useState, useCallback } from 'react';

const BASE = '/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, path, body) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('rinran_token');
      const headers = {};
      if (body) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        localStorage.removeItem('rinran_token');
        window.location.reload();
        return null;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}
