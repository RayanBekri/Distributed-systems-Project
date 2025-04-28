const express    = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const amqp       = require('amqplib');

const app      = express();
const port     = process.env.PORT     || 4003;
const INSTANCE = process.env.INSTANCE || 'update';

const MONGO_URL = `mongodb://mongo-primary:27017/sampledb`;
const RABBIT_URL = `amqp://user:password@rabbitmq:5672`;
const QUEUE     = 'task_queue';

let db, rabbitChannel;

async function init() {
  const client = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  db = client.db();
  console.log(`✔ [${INSTANCE}] Connected to MongoDB`);

  const maxRetries = 5, delayMs = 5000;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await amqp.connect(RABBIT_URL);
      rabbitChannel = await conn.createChannel();
      await rabbitChannel.assertQueue(QUEUE, { durable: true });
      console.log(`✔ [${INSTANCE}] Connected to RabbitMQ`);
      break;
    } catch (err) {
      console.error(`❌ [${INSTANCE}] RabbitMQ attempt ${i}/${maxRetries} failed: ${err.message}`);
      if (i === maxRetries) process.exit(1);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
init().catch(err => {
  console.error(`❌ [${INSTANCE}] Initialization error:`, err);
  process.exit(1);
});

function enqueueCall(task) {
  if (!rabbitChannel) return;
  const msg = { service: INSTANCE, task, timestamp: new Date().toISOString() };
  rabbitChannel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(msg)), { persistent: true });
  console.log(`→ [${INSTANCE}] Enqueued`, msg);
}

app.use(bodyParser.json());

app.post('/api/testdata/update/:value', async (req, res) => {
  enqueueCall('update');
  const value = parseInt(req.params.value, 10);
  const updates = req.body;
  try {
    const result = await db.collection('testData').findOneAndUpdate(
      { value },
      { $set: updates },
      { returnOriginal: false }
    );
    if (!result.value) return res.status(404).send('Not found');
    res.json(result.value);
  } catch (err) {
    console.error(`❌ [${INSTANCE}] DB error:`, err);
    res.status(500).send(err.toString());
  }
});

app.listen(port, () => {
  console.log(`🚀 [${INSTANCE}] Listening on port ${port}`);
});
