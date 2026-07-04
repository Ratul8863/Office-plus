// scripts/smoke-publish.js
// One-shot synthetic Wokwi telemetry test: connects to MQTT_BROKER_URL and
// publishes payload to MQTT_TOPIC. Mirrors exactly what esp32-office-room.ino
// emits every 2 s, so we can verify the backend pipeline without Wokwi.
const mqtt = require('mqtt');

const url   = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883';
const topic = process.env.MQTT_TOPIC      || 'office/wokwi/work1/telemetry';
const mode  = process.argv[2] || 'on';   // 'on' or 'off'

const devices = [
  'work1-fan-1',
  'work1-fan-2',
  'work1-light-1',
  'work1-light-2',
  'work1-light-3',
];

const payload = {
  source: 'wokwi-esp32-work1',
  roomId: 'work1',
  devices: devices.map((deviceId) => ({ deviceId, status: mode === 'on' ? 'on' : 'off' })),
  timestamp: new Date().toISOString(),
};

console.log(`[smoke] connecting to ${url}`);
const client = mqtt.connect(url, {
  clientId: `officepulse-smoke-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 0,
  connectTimeout: 10 * 1000,
});

client.on('connect', () => {
  console.log(`[smoke] connected → publishing ${devices.length} devices (mode=${mode}) to ${topic}`);
  client.publish(topic, JSON.stringify(payload), { qos: 0, retain: false }, (err) => {
    if (err) console.error('[smoke] publish error:', err.message);
    else console.log('[smoke] publish OK');
    // Give the broker time to receive + fan out the packet before we close.
    setTimeout(() => {
      client.end(false, () => process.exit(err ? 1 : 0));
    }, 500);
  });
});

client.on('error', (e) => {
  console.error('[smoke] mqtt error:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('[smoke] connect timeout');
  process.exit(2);
}, 15000);
