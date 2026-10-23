// Development-only SMTP sink: local memory, no forwarding and no database access.
const net = require('node:net');
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function readMessage(raw) {
  const boundary = raw.indexOf('\r\n\r\n');
  const headerText = boundary < 0 ? raw : raw.slice(0, boundary);
  let text = boundary < 0 ? '' : raw.slice(boundary + 4);
  const headers = {};
  for (const line of headerText.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
  }
  if (headers['content-transfer-encoding']?.toLowerCase() === 'base64') text = Buffer.from(text, 'base64').toString('utf8');
  if (headers['content-transfer-encoding']?.toLowerCase() === 'quoted-printable') {
    text = Buffer.from(text.replace(/=\r\n/g, '').replace(/=([\da-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8');
  }
  return { subject: headers.subject || '(no subject)', text };
}

async function startMailbox({ smtpPort = 1025, httpPort = 8025, host = '127.0.0.1' } = {}) {
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('Mailbox must bind to a loopback address');
  const messages = [];
  const sockets = new Set();
  const smtp = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setTimeout(60000, () => socket.destroy());
    socket.setEncoding('utf8');
    let buffer = '', greeted = false, inData = false, sender, recipients = [], data = [], bytes = 0;
    const reset = () => { sender = undefined; recipients = []; data = []; bytes = 0; inData = false; };
    const reply = line => socket.write(line + '\r\n');
    reply('220 localhost SME development mailbox');
    socket.on('data', chunk => {
      buffer += chunk;
      // Bound both command lines and an incomplete DATA line before accepting more input.
      if (Buffer.byteLength(buffer) + bytes > MAX_MESSAGE_BYTES + 8192) {
        socket.end('552 Message too large\r\n'); return;
      }
      let index;
      while ((index = buffer.indexOf('\r\n')) >= 0 && !socket.writableEnded) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            messages.unshift({ id: randomUUID(), from: sender, to: [...recipients], ...readMessage(data.join('\r\n')), receivedAt: new Date().toISOString() });
            if (messages.length > MAX_MESSAGES) messages.pop();
            reset(); reply('250 Message accepted locally');
          } else {
            const unstuffed = line.startsWith('..') ? line.slice(1) : line;
            bytes += Buffer.byteLength(unstuffed) + 2;
            if (bytes > MAX_MESSAGE_BYTES) { socket.end('552 Message too large\r\n'); return; }
            data.push(unstuffed);
          }
          continue;
        }
        if (line.length > 8192) { socket.end('500 Command too long\r\n'); return; }
        const [verb] = line.toUpperCase().split(' ');
        if (verb === 'EHLO' || verb === 'HELO') {
          greeted = true; reset();
          reply(verb === 'EHLO' ? `250-localhost\r\n250 SIZE ${MAX_MESSAGE_BYTES}` : '250 localhost');
        } else if (verb === 'QUIT') socket.end('221 Goodbye\r\n');
        else if (verb === 'NOOP') reply('250 OK');
        else if (verb === 'RSET') { reset(); reply('250 OK'); }
        else if (verb === 'MAIL') {
          const match = /^MAIL FROM:\s*<([^<>\r\n]*)>(?:\s+SIZE=\d+)?$/i.exec(line);
          if (!greeted) reply('503 Send HELO first');
          else if (!match) reply('501 Invalid sender');
          else { reset(); sender = match[1]; reply('250 Sender accepted'); }
        } else if (verb === 'RCPT') {
          const match = /^RCPT TO:\s*<([^<>\r\n]+)>$/i.exec(line);
          if (sender === undefined) reply('503 Send MAIL first');
          else if (!match) reply('501 Invalid recipient');
          else if (recipients.length >= 100) reply('452 Too many recipients');
          else { recipients.push(match[1]); reply('250 Recipient accepted'); }
        } else if (verb === 'DATA') {
          if (!recipients.length) reply('503 Send MAIL and RCPT first');
          else { inData = true; reply('354 End with <CRLF>.<CRLF>'); }
        } else reply('502 Command not implemented');
      }
    });
  });
  smtp.maxConnections = 64;
  const inbox = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
    if (request.url === '/api/messages' && request.method === 'GET') {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(messages));
    } else if (request.url === '/api/messages' && request.method === 'DELETE') {
      if (request.headers.origin) { response.writeHead(403); response.end(); return; }
      messages.length = 0; response.writeHead(204); response.end();
    } else if (request.url === '/' && request.method === 'GET') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>SME local mailbox</title><style>body{font:16px system-ui;margin:2rem;max-width:1000px;background:#f5f6fa;color:#18233c}article{background:white;border:1px solid #dce1ed;padding:1rem;margin:1rem 0;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#4f5d76}</style></head><body><h1>SME local mailbox</h1><p>Development only. Messages stay in local memory and are never delivered to the internet. Refreshes every 5 seconds; restart clears the inbox. Latest 100 messages.</p>${messages.length ? messages.map(message => `<article><h2>${escapeHtml(message.subject)}</h2><small>From: ${escapeHtml(message.from)}<br>To: ${escapeHtml(message.to.join(', '))}<br>${escapeHtml(message.receivedAt)}</small><pre>${escapeHtml(message.text)}</pre></article>`).join('') : '<p>No local messages received.</p>'}</body></html>`);
    } else { response.writeHead(404); response.end('Not found'); }
  });
  inbox.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  const listen = (server, port) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  const close = async () => {
    for (const socket of sockets) socket.destroy();
    await Promise.all([smtp, inbox].map(server => new Promise(resolve => server.listening ? server.close(resolve) : resolve())));
  };
  try { await listen(smtp, smtpPort); await listen(inbox, httpPort); }
  catch (error) { await close(); throw error; }
  return { smtpPort: smtp.address().port, httpPort: inbox.address().port, close };
}

module.exports = { startMailbox };
if (require.main === module) {
  startMailbox({ smtpPort: Number(process.env.MAILBOX_SMTP_PORT || 1025), httpPort: Number(process.env.MAILBOX_HTTP_PORT || 8025) }).then(mailbox => {
    console.log(`Local SMTP: smtp://127.0.0.1:${mailbox.smtpPort}`);
    console.log(`Local inbox: http://127.0.0.1:${mailbox.httpPort}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { mailbox.close().then(() => process.exit(0)); });
  }).catch(error => { console.error(`Local mailbox failed to start: ${error.code || error.message}`); process.exitCode = 1; });
}
