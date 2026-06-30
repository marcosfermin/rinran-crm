// Server-Sent Events — real-time push to connected browser clients
const clients = new Map(); // userId (string) → Set<res>

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const resSet of clients.values()) {
    for (const res of resSet) {
      try { res.write(msg); } catch {}
    }
  }
}

function sendToUser(userId, event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const resSet = clients.get(String(userId));
  if (!resSet) return;
  for (const res of resSet) {
    try { res.write(msg); } catch {}
  }
}

function sseRouter(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');

  const userId = String(req.user.id);
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);

  const keepAlive = setInterval(() => {
    try { res.write(':ping\n\n'); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const resSet = clients.get(userId);
    if (resSet) {
      resSet.delete(res);
      if (resSet.size === 0) clients.delete(userId);
    }
  });
}

module.exports = { sseRouter, broadcast, sendToUser };
