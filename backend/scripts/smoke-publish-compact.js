// scripts/smoke-publish-compact.js
// Publishes a compact, single-device Wokwi-style payload to MQTT_TOPIC.
//
//   node scripts/smoke-publish-compact.js work1_fan_1 ON
//   node scripts/smoke-publish-compact.js work1_light_3 OFF
//
// The backend normalises this to:
//   { roomId: "work1", devices: [{ deviceId: "work1-fan-1", status: "on" }] }
const mqtt = require('mqtt');

const url      = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883';
const topic    = process.env.MQTT_TOPIC      || 'office/wokwi/work1/telemetry';
const deviceId = process.argv[2];
const rawStat  = (process.argv[3] || 'ON').toUpperCase();
const status   = rawStat === 'OFF' ? 'OFF' : 'ON';

if (!deviceId) {
  console.error('usage: node scripts/smoke-publish-compact.js <work1_<type>_<n>> <ON|OFF>');
  process.exit(2);
}

const payload = {
  source: 'wokwi-cli-compact',
  roomId: 'work1',
  deviceId,
  status,
  timestamp: new Date().toISOString(),
};

console.log(`[smoke-compact] connecting to ${url}`);
const client = mqtt.connect(url, {
  clientId: `officepulse-compact-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 0,
  connectTimeout: 10 * 1000,
});

client.on('connect', () => {
  console.log(`[smoke-compact] connected → publishing compact ${deviceId}=${status} to ${topic}`);
  client.publish(topic, JSON.stringify(payload), { qos: 0, retain: false }, (err) => {
    if (err) console.error('[smoke-compact] publish error:', err.message);
    else console.log('[smoke-compact] publish OK');
    setTimeout(() => client.end(false, () => process.exit(err ? 1 : 0)), 500);
  });
});

client.on('error', (e) => {
  console.error('[smoke-compact] mqtt error:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('[smoke-compact] connect timeout');
  process.exit(3);
}, 15000);