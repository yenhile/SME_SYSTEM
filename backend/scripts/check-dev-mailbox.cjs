const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');

async function connect(port) {
  const socket = net.connect(port, '127.0.0.1');
  socket.setTimeout(10000, () => socket.destroy(new Error('SMTP test timeout')));
  socket.setEncoding('utf8');
  let buffer = '', pending;
  const lines = [];
  socket.on('data', chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      if (/^\d{3} /.test(line)) {
        if (pending) { const resolve = pending; pending = undefined; resolve(line); }
        else lines.push(line);
      }
    }
  });
  const response = () => lines.length ? Promise.resolve(lines.shift()) : new Promise(resolve => { pending = resolve; });
  await once(socket, 'connect');
  assert.match(await response(), /^220 /);
  return { socket, async command(command, code) { socket.write(command + '\r\n'); assert.match(await response(), new RegExp(`^${code} `)); } };
}

async function main() {
  const { startMailbox } = require('./dev-mailbox.cjs');
  const mailbox = await startMailbox({ smtpPort: 0, httpPort: 0 });
  const base = `http://127.0.0.1:${mailbox.httpPort}`;
  try {
    const client = await connect(mailbox.smtpPort);
    await client.command('EHLO local.test', 250);
    await client.command('DATA', 503);
    await client.command('MAIL FROM:<sender@example.test>', 250);
    await client.command('RCPT TO:<recipient@example.test>', 250);
    await client.command('DATA', 354);
    await client.command('Subject: <script>alert(1)</script>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nCode: 123456\r\n..dot\r\n.', 250);
    await client.command('NOOP', 250);
    await client.command('RSET', 250);
    await client.command('QUIT', 221);
    const messages = await (await fetch(`${base}/api/messages`)).json();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].from, 'sender@example.test');
    assert.deepEqual(messages[0].to, ['recipient@example.test']);
    assert.equal(messages[0].text, 'Code: 123456\r\n.dot');
    assert.ok(messages[0].id && messages[0].receivedAt);
    const html = await (await fetch(base)).text();
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.equal((await fetch(`${base}/api/messages`, { method: 'DELETE' })).status, 204);
    assert.deepEqual(await (await fetch(`${base}/api/messages`)).json(), []);
    const bounded = await connect(mailbox.smtpPort);
    await bounded.command('HELO local.test', 250);
    for (let index = 0; index < 101; index++) {
      await bounded.command('MAIL FROM:<sender@example.test>', 250);
      await bounded.command('RCPT TO:<recipient@example.test>', 250);
      await bounded.command('DATA', 354);
      await bounded.command(`Subject: ${index}\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from('Code: 654321').toString('base64')}\r\n.`, 250);
    }
    const latest = await (await fetch(`${base}/api/messages`)).json();
    assert.equal(latest.length, 100);
    assert.equal(latest[0].subject, '100');
    assert.equal(latest[99].subject, '1');
    assert.equal(latest[0].text, 'Code: 654321');
    await bounded.command('MAIL FROM:<sender@example.test>', 250);
    await bounded.command('RCPT TO:<recipient@example.test>', 250);
    await bounded.command('DATA', 354);
    await bounded.command('X'.repeat(2 * 1024 * 1024 + 1), 552);
    assert.equal((await (await fetch(`${base}/api/messages`)).json()).length, 100);
    assert.equal((await fetch(`${base}/api/messages`, { method: 'DELETE', headers: { Origin: 'https://example.test' } })).status, 403);
    await assert.rejects(startMailbox({ host: '0.0.0.0', smtpPort: 0, httpPort: 0 }), /loopback/);
    // Occupied HTTP port must reject startup and release the SMTP listener.
    const blocker = net.createServer();
    blocker.listen(0, '127.0.0.1'); await once(blocker, 'listening');
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
    const freePort = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    try {
      await assert.rejects(startMailbox({ smtpPort: freePort, httpPort: blocker.address().port }), { code: 'EADDRINUSE' });
      probe.listen(freePort, '127.0.0.1'); await once(probe, 'listening');
      await new Promise(resolve => probe.close(resolve));
    } finally { await new Promise(resolve => blocker.close(resolve)); }
    console.log('PASS SMTP delivery/commands, dot unstuffing, base64, bounded inbox, 2MB limit, escaped UI/API, clear, origin/bind restrictions, startup cleanup');
  } finally { await mailbox.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
