// scripts/smoke-listen.js
// Subscribes to the Wokwi topic and prints any messages it sees for 5 s.
// Used to confirm whether test.mosquitto.org is actually delivering messages
// published on office/wokwi/work1/telemetry.
const mqtt = require('mqtt');

const url   = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883';
const topic = process.env.MQTT_TOPIC      || 'office/wokwi/work1/telemetry';
const deadlineMs = 5000;

console.log(`[listen] connecting to ${url}, topic=${topic}`);
const client = mqtt.connect(url, {
  clientId: `officepulse-listen-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 0,
  connectTimeout: 10 * 1000,
});

client.on('connect', () => {
  console.log('[listen] connected; subscribing');
  client.subscribe(topic, { qos: 0 }, (err) => {
    if (err) {
      console.error('[listen] subscribe err:', err);
      process.exit(1);
    }
    console.log('[listen] subscribed; waiting 5s for messages');
  });
});

client.on('message', (t, payload, pkt) => {
  console.log(`[listen] MSG topic=${t} payload=${payload.toString().slice(0, 500)}`);
});

client.on('error', (e) => {
  console.error('[listen] mqtt error:', e.message);
});

setTimeout(() => {
  console.log('[listen] timeout reached, exiting');
  client.end(true, () => process.exit(0));
}, deadlineMs);
