// scripts/smoke-broker.js
// Tiny in-process MQTT 3.1.1 broker (no external deps) that listens on the
// loopback port given by PORT (default 1899). It accepts arbitrary numbers of
// TCP connections speaking raw MQTT 3.1.1 and forwards QoS 0 PUBLISH packets
// to any subscribers matching by topic filter (supports + and # wildcards).
//
// It is NOT a general broker — it exists only so we can end-to-end test the
// backend's MQTT subscriber path without depending on the flaky public
// test.mosquitto.org broker.
//
// Wire protocol reference: MQTT 3.1.1, OASIS Standard.
//   https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html
//
// Implemented packet types:
//   1  CONNECT     -> 2 CONNACK
//   8  SUBSCRIBE   -> 9 SUBACK
//   3  PUBLISH     -> forward to other clients (QoS 0 only)
//   12 PINGREQ     -> 13 PINGRESP
//   14 DISCONNECT  -> close
'use strict';
const net = require('net');

const PORT = parseInt(process.env.PORT || '1899', 10);

// Track subscriptions per connection: Map<sock, Set<topicFilter>>
const subs = new Map();
// Track all active client sockets
const clients = new Set();

function log(...args) {
  console.log(`[broker]`, ...args);
}

function encodeRemainingLength(len) {
  const out = [];
  do {
    let b = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) b |= 0x80;
    out.push(b);
  } while (len > 0);
  return Buffer.from(out);
}

function makePacket(type, variableHeader, payload = Buffer.alloc(0)) {
  const vh = Buffer.isBuffer(variableHeader) ? variableHeader : Buffer.from(variableHeader);
  const remLen = vh.length + payload.length;
  return Buffer.concat([Buffer.from([(type << 4) | 0]), encodeRemainingLength(remLen), vh, payload]);
}

function topicMatches(filter, topic) {
  // + matches one level, # matches trailing levels
  if (filter === topic) return true;
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (f[i] === '+') {
      if (i >= t.length) return false;
      continue;
    }
    if (f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

function deliverToSubscribers(publishingSock, topic, payload, qos) {
  let delivered = 0;
  for (const sock of clients) {
    if (sock === publishingSock) continue;
    const mySubs = subs.get(sock);
    if (!mySubs) continue;
    for (const filter of mySubs) {
      if (topicMatches(filter, topic)) {
        const topicLenBuf = Buffer.alloc(2);
        topicLenBuf.writeUInt16BE(topic.length, 0);
        // PUBLISH variable header is: topic length (2 bytes) + topic name
        // (no flags byte; QoS/DUP/RETAIN live in the fixed header's low nibble).
        const variableHeader = Buffer.concat([topicLenBuf, Buffer.from(topic)]);
        const pkt = makePacket(3, variableHeader, payload);
        try {
          sock.write(pkt);
          delivered++;
        } catch (e) {
          log('forward write error:', e.message);
        }
      }
    }
  }
  log('delivered to', delivered, 'subscribers');
}

const server = net.createServer((sock) => {
  const remote = `${sock.remoteAddress}:${sock.remotePort}`;
  log('client connected', remote);
  clients.add(sock);
  subs.set(sock, new Set());

  let buf = Buffer.alloc(0);

  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    // Try to parse and consume complete MQTT packets
    while (buf.length >= 2) {
      const fixedByte = buf[0];
      const type = (fixedByte >> 4) & 0x0f;
      let remLen = 0;
      let multiplier = 1;
      let i = 1;
      while (i < buf.length) {
        const b = buf[i++];
        remLen += (b & 0x7f) * multiplier;
        multiplier *= 128;
        if ((b & 0x80) === 0) break;
        if (multiplier > 128 * 128 * 128) { // malformed
          sock.destroy();
          return;
        }
      }
      if (i === 0 || buf.length < i + remLen) break; // incomplete
      // i now points to start of variable header (= 1 + num remLen bytes)
      const packet = buf.slice(0, i + remLen);
      buf = buf.slice(i + remLen);

      handlePacket(sock, type, packet, i);
    }
  });

  sock.on('error', () => {});
  sock.on('close', () => {
    clients.delete(sock);
    subs.delete(sock);
    log('client closed', remote);
  });

  function handlePacket(sock, type, packet, vhOffset) {
    if (type === 1) {
      // CONNECT — just accept
      const connack = Buffer.from([0x20, 0x02, 0x00, 0x00]); // success
      sock.write(connack);
      log('CONNECT → CONNACK');
    } else if (type === 8) {
      // SUBSCRIBE
      // Variable header: packet id (2 bytes). Payload: list of (topic filter, qos).
      const packetId = packet.readUInt16BE(vhOffset);
      let p = vhOffset + 2;
      const subackPayload = Buffer.from([(packetId >> 8) & 0xff, packetId & 0xff, 0x00]); // granted QoS 0
      // suback fixed header: 9 << 4 = 0x90
      sock.write(Buffer.concat([Buffer.from([0x90, subackPayload.length]), subackPayload]));
      while (p < packet.length) {
        const topicLen = packet.readUInt16BE(p); p += 2;
        const topic = packet.slice(p, p + topicLen).toString(); p += topicLen;
        p += 1; // requested QoS
        log('SUBSCRIBE', topic, '(packet len =', packet.length, ')');
        const subSet = subs.get(sock);
        if (!subSet) {
          log('WARN no sub set for this socket!');
        } else {
          subSet.add(topic);
          log('  -> subs size now =', subSet.size);
        }
      }
    } else if (type === 3) {
      // PUBLISH
      const flags = packet[0] & 0x0f;
      const dup = (flags & 0x08) !== 0;
      const qos = (flags >> 1) & 0x03;
      const retain = (flags & 0x01) !== 0;
      void dup; void retain;
      const topicLen = packet.readUInt16BE(vhOffset);
      const topic = packet.slice(vhOffset + 2, vhOffset + 2 + topicLen).toString();
      let p = vhOffset + 2 + topicLen;
      // For QoS > 0 there's a packet id, but we only do QoS 0
      if (qos > 0) p += 2;
      const payload = packet.slice(p);
      log('PUBLISH', topic, payload.toString().slice(0, 80));
      deliverToSubscribers(sock, topic, payload, qos);
    } else if (type === 12) {
      // PINGREQ → PINGRESP
      sock.write(Buffer.from([0xd0, 0x00]));
    } else if (type === 14) {
      // DISCONNECT
      log('DISCONNECT');
      sock.end();
    } else if (type === 16) {
      // AUTH (MQTT 5) — ignore
    } else {
      log('unknown packet type', type);
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on mqtt://127.0.0.1:${PORT}`);
});