const amqp = require('amqplib');
const fs   = require('fs');

const INSTANCE   = 'worker';
const RABBIT_HOST = 'rabbitmq';
const RABBIT_PORT = 5672;
const RABBIT_USER = 'user';
const RABBIT_PASS = 'password';
const RABBIT_URL  = `amqp://${RABBIT_USER}:${RABBIT_PASS}@${RABBIT_HOST}:${RABBIT_PORT}`;
const QUEUE       = 'task_queue';

const logFilePath = 'worker.log';
const logStream   = fs.createWriteStream(logFilePath, { flags: 'a' });

(async function init() {
  let channel;
  const max   = 5;
  const delay = 5000;

  for (let i = 1; i <= max; i++) {
    try {
      const conn = await amqp.connect(RABBIT_URL);
      channel    = await conn.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      console.log(`✔ [${INSTANCE}] Connected to RabbitMQ at ${RABBIT_URL}`);
      break;
    } catch (err) {
      console.error(`❌ [${INSTANCE}] Attempt ${i}/${max} failed:`, err.message);
      if (i === max) process.exit(1);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  channel.prefetch(1);
  console.log(`👂 [${INSTANCE}] Waiting for messages…`);

  channel.consume(QUEUE, async msg => {
    const payload = JSON.parse(msg.content.toString());
    const logEntry = {
      receivedAt: new Date().toISOString(),
      ...payload
    };

    console.log(`→ [${INSTANCE}] Received`, payload);

    logStream.write(JSON.stringify(logEntry) + '\n');

    await new Promise(r => setTimeout(r, 1000));

    console.log(`✔ [${INSTANCE}] Done processing '${payload.service}'`);
    logStream.write(JSON.stringify({
      processedAt: new Date().toISOString(),
      service: payload.service,
      instance: INSTANCE
    }) + '\n');

    channel.ack(msg);
  }, { noAck: false });
})();
