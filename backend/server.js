const express    = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const amqp       = require('amqplib');

const app  = express();
const port = 4000;
app.use(bodyParser.json());

const dbHost   = 'mongodb';
const dbPort   = 27017;
const dbName   = 'sampledb';
const mongoUrl = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672';
const queue     = 'task_queue';

let db, rabbitChannel;

async function init() {
  const client = await MongoClient.connect(mongoUrl);
  db = client.db(dbName);
  console.log('✔ MongoDB connected');

  const maxRetries = 5, delayMs = 5000;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await amqp.connect(rabbitUrl);
      rabbitChannel = await conn.createChannel();
      await rabbitChannel.assertQueue(queue, { durable: true });
      console.log('✔ RabbitMQ connected');
      break;
    } catch (err) {
      console.log(`RabbitMQ attempt ${i}/${maxRetries} failed; retrying in ${delayMs/1000}s…`);
      if (i === maxRetries) {
        console.error('❌ Could not connect to RabbitMQ:', err);
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

init().catch(err => {
  console.error('Initialization error', err);
  process.exit(1);
});

function enqueueCall(type) {
  if (!rabbitChannel) return;
  const msg = { status: 'queued', task: type };
  rabbitChannel.sendToQueue(queue, Buffer.from(JSON.stringify(msg)), { persistent: true });
  console.log(msg);
}


app.get('/api/testdata', async (req, res) => {
  enqueueCall('get-call');
  try {
    const data = await db.collection('testData').find().toArray();
    res.json(data);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.get('/api/testdata/:value', async (req, res) => {
  enqueueCall('get-call');
  try {
    const value = parseInt(req.params.value, 10);
    const item  = await db.collection('testData').findOne({ value });
    if (!item) return res.status(404).send('Not found');
    res.json(item);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.post('/api/testdata', async (req, res) => {
  enqueueCall('post-call');
  try {
    const newItem = req.body;
    const result  = await db.collection('testData').insertOne(newItem);
    res.status(201).json(result.ops ? result.ops[0] : newItem);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.post('/api/testdata/update/:value', async (req, res) => {
  enqueueCall('post-call');
  try {
    const value      = parseInt(req.params.value, 10);
    const updateData = req.body;
    const result     = await db.collection('testData').findOneAndUpdate(
      { value },
      { $set: updateData },
      { returnOriginal: false }
    );
    res.json(result.value);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
