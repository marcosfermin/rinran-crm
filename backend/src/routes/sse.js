// Server-Sent Events — real-time push to connected browser clients
const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
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
  clients.add(res);

  const keepAlive = setInterval(() => {
    try { res.write(':ping\n\n'); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
}

module.exports = { sseRouter, broadcast };
