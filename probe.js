const axios = require('axios');
const base = process.env.OPENWA_URL?.replace(/\/$/, '');
const key = process.env.OPENWA_API_KEY;
const session = 'f04903a6-24fa-4e0f-8af8-a9667d54ba71';
const headers = { Accept: 'application/json' };
if (key) headers['Authorization'] = 'Bearer ' + key;

console.log('Probing:', base);
console.log('API key:', key ? 'YES' : 'NO');

const paths = [
  '/api/sessions',
  '/api/sessions/' + session,
  '/api/sessions/' + session + '/chats',
  '/api/sessions/' + session + '/contacts',
  '/api/sessions/' + session + '/messages',
  '/api/' + session + '/all-chats',
  '/api/' + session + '/chats',
];

(async () => {
  for (const p of paths) {
    try {
      const r = await axios.get(base + p, { timeout: 5000, headers });
      const isJson = r.headers['content-type']?.includes('json');
      console.log('OK ', p, r.status, isJson ? JSON.stringify(r.data).slice(0, 150) : '(html)');
    } catch (e) {
      console.log('ERR', p, e.response?.status || e.code || e.message.slice(0, 30));
    }
  }
})();
