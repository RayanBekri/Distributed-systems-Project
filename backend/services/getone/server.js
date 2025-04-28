const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 4001;
const INSTANCE = process.env.INSTANCE_ID || os.hostname();

const MONGO_HOSTS = [
  'mongo-primary:27017',
  'mongo-replica1:27017',
  'mongo-replica2:27017'
];
const DB_NAME = 'sampledb';
const RABBIT_URL = 'amqp://user:password@rabbitmq:5672';
const QUEUE = 'task_queue';

let db, rabbitChannel;

async function connectToMongo() {
  const maxRetries = 5, delay = 2000;
  for (let i = 1; i <= maxRetries; i++) {
    for (const host of MONGO_HOSTS) {
      try {
        const client = await MongoClient.connect(
          `mongodb://${host}/${DB_NAME}`,
          { useNewUrlParser: true, useUnifiedTopology: true }
        );
        db = client.db(DB_NAME);
        console.log(`✔ [${INSTANCE}] MongoDB connected to ${host}`);
        return;
      } catch (err) {
        console.warn(`❌ [${INSTANCE}] MongoDB ${host} failed (${i}): ${err.message}`);
      }
    }
    console.log(`⏳ [${INSTANCE}] Mongo retry ${i}/${maxRetries}`);
    await new Promise(r => setTimeout(r, delay));
  }
  process.exit(1);
}

async function connectToRabbit() {
  const maxRetries = 5, delay = 2000;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await amqp.connect(RABBIT_URL);
      rabbitChannel = await conn.createChannel();
      await rabbitChannel.assertQueue(QUEUE, { durable: true });
      console.log(`✔ [${INSTANCE}] RabbitMQ connected`);
      return;
    } catch (err) {
      console.warn(`❌ [${INSTANCE}] RabbitMQ failed (${i}): ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  process.exit(1);
}

function enqueueCall(type, extra) {
  const ip = (req => req.headers['x-forwarded-for'] || req.connection.remoteAddress)(app.request);
  const msg = {
    service: 'getone',
    instance: INSTANCE,
    ip,
    timestamp: new Date().toISOString(),
    task: type,
    ...extra
  };
  rabbitChannel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(msg)), { persistent: true });
  console.log(`→ [${INSTANCE}] Enqueued`, msg);
}

async function init() {
  await connectToMongo();
  await connectToRabbit();
}

init().catch(err => {
  console.error(`❌ [${INSTANCE}] Init failed:`, err);
  process.exit(1);
});

app.use(bodyParser.json());

app.get('/health', (_, res) => {
  res.send(`OK:${INSTANCE}`);
});

app.get('/api/testdata/:value', async (req, res) => {
  const val = parseInt(req.params.value, 10);
  enqueueCall('getone', { value: val });
  try {
    const doc = await db.collection('testData').findOne({ value: val });
    if (!doc) return res.status(404).send('Not found');
    res.json(doc);
  } catch (err) {
    console.error(`❌ [${INSTANCE}] DB error:`, err);
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [${INSTANCE}] getone listening on ${PORT}`);
});
