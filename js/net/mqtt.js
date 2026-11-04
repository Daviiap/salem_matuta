// Cliente MQTT 3.1.1 mínimo sobre WebSocket (sem dependências).
// Suporta CONNECT, SUBSCRIBE, PUBLISH QoS 0 (com retain), PINGREQ e reconexão automática.

const enc = new TextEncoder();
const dec = new TextDecoder();

function encLen(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

function str(s) {
  const b = enc.encode(s);
  return [b.length >> 8, b.length & 0xff, ...b];
}

function packet(header, body) {
  const len = encLen(body.length);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = header;
  out.set(len, 1);
  out.set(body, 1 + len.length);
  return out;
}

export class MqttClient {
  constructor(url, { keepalive = 30 } = {}) {
    this.url = url;
    this.keepalive = keepalive;
    this.clientId = 'saba-' + Math.random().toString(36).slice(2, 12);
    this.subs = new Set();
    this.handlers = { message: [], status: [] };
    this.buf = new Uint8Array(0);
    this.packetId = 1;
    this.connected = false;
    this.closed = false;
    this.backoff = 1000;
    this.queue = [];
  }

  on(ev, fn) { this.handlers[ev].push(fn); return this; }
  emit(ev, ...a) { for (const fn of this.handlers[ev]) { try { fn(...a); } catch (e) { console.error(e); } } }

  connect() {
    this.closed = false;
    this.emit('status', 'connecting');
    let ws;
    try {
      ws = new WebSocket(this.url, 'mqtt');
    } catch (e) {
      this.emit('status', 'error', e.message);
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      const body = [...str('MQTT'), 4, 0x02, this.keepalive >> 8, this.keepalive & 0xff, ...str(this.clientId)];
      ws.send(packet(0x10, body));
    };
    ws.onmessage = (e) => this.onData(new Uint8Array(e.data));
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      clearInterval(this.pingTimer);
      if (was) this.emit('status', 'disconnected');
      if (!this.closed) this.scheduleReconnect();
    };
    ws.onerror = () => { /* onclose cuida */ };
  }

  scheduleReconnect() {
    clearTimeout(this.reTimer);
    this.reTimer = setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 15000);
  }

  close() {
    this.closed = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.reTimer);
    try { this.ws?.send(new Uint8Array([0xe0, 0])); this.ws?.close(); } catch { /* ignore */ }
  }

  onData(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length);
    b.set(this.buf); b.set(chunk, this.buf.length);
    this.buf = b;
    for (;;) {
      if (this.buf.length < 2) return;
      let mult = 1, len = 0, i = 1, byte;
      do {
        if (i >= this.buf.length) return;
        byte = this.buf[i++];
        len += (byte & 0x7f) * mult;
        mult *= 128;
      } while (byte & 0x80);
      if (this.buf.length < i + len) return;
      const header = this.buf[0];
      const body = this.buf.slice(i, i + len);
      this.buf = this.buf.slice(i + len);
      this.handlePacket(header, body);
    }
  }

  handlePacket(header, body) {
    const type = header >> 4;
    if (type === 2) { // CONNACK
      if (body[1] !== 0) { this.emit('status', 'error', 'Conexão recusada pelo broker (' + body[1] + ')'); return; }
      this.connected = true;
      this.backoff = 1000;
      for (const t of this.subs) this.sendSubscribe(t);
      this.pingTimer = setInterval(() => this.ws?.send(new Uint8Array([0xc0, 0])), (this.keepalive * 1000) / 2);
      const q = this.queue.splice(0);
      for (const p of q) this.ws.send(p);
      this.emit('status', 'connected');
    } else if (type === 3) { // PUBLISH
      const qos = (header >> 1) & 3;
      const tlen = (body[0] << 8) | body[1];
      const topic = dec.decode(body.slice(2, 2 + tlen));
      let off = 2 + tlen;
      if (qos > 0) {
        const pid = [body[off], body[off + 1]];
        off += 2;
        if (qos === 1) this.ws.send(new Uint8Array([0x40, 2, ...pid])); // PUBACK
      }
      const payload = dec.decode(body.slice(off));
      this.emit('message', topic, payload);
    }
    // SUBACK (9) e PINGRESP (13) não precisam de tratamento
  }

  sendSubscribe(topic) {
    const id = this.packetId++ & 0xffff || 1;
    this.ws.send(packet(0x82, [id >> 8, id & 0xff, ...str(topic), 0]));
  }

  subscribe(topic) {
    this.subs.add(topic);
    if (this.connected) this.sendSubscribe(topic);
  }

  publish(topic, payload, { retain = false } = {}) {
    const p = packet(0x30 | (retain ? 1 : 0), [...str(topic), ...enc.encode(payload)]);
    if (this.connected) this.ws.send(p);
    else { this.queue.push(p); if (this.queue.length > 50) this.queue.shift(); }
  }
}
