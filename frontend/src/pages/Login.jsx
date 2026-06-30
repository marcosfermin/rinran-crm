import { useState } from 'react';
import { MessageSquare, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = requires2fa
        ? { email: form.email.trim(), password: form.password, totp_code: totpCode }
        : { email: form.email.trim(), password: form.password };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al iniciar sesión'); return; }
      if (data.requires_2fa) {
        setRequires2fa(true);
        return;
      }
      login(data.token, data.user);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-green-500/10 rounded-2xl p-3">
            <MessageSquare className="text-green-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-none">
              Rinran <span className="text-green-400">CRM</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">WhatsApp inbox & contacts</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
          {!requires2fa ? (
            <>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Email</label>
                <input type="email" autoComplete="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                  placeholder="admin@rinran.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Contraseña</label>
                <input type="password" autoComplete="current-password" required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                  placeholder="••••••••" />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-yellow-400">
                <Shield size={16} />
                <span className="text-sm font-medium text-white">Verificación en 2 pasos</span>
              </div>
              <p className="text-xs text-gray-400">Ingresa el código de 6 dígitos de tu app autenticadora.</p>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                autoFocus value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-2xl text-white text-center tracking-[0.5em] font-mono focus:outline-none focus:border-yellow-500 transition-colors"
                placeholder="000000" />
              <button type="button" onClick={() => { setRequires2fa(false); setTotpCode(''); setError(''); }}
                className="text-xs text-gray-500 hover:text-white transition-colors">
                ← Volver al login
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || (requires2fa && totpCode.length < 6)}
            className="w-full bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
            {loading ? 'Verificando...' : requires2fa ? 'Verificar código' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
