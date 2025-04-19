const amqp = require('amqplib');

const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672';
const queue     = 'task_queue';

async function init() {
  let conn, ch;
  const maxRetries = 5;
  const delayMs    = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      conn = await amqp.connect(rabbitUrl);
      ch   = await conn.createChannel();
      await ch.assertQueue(queue, { durable: true });
      console.log('✔ RabbitMQ connected');
      break;
    } catch (err) {
      console.log(`RabbitMQ connection ${attempt}/${maxRetries} failed, retrying in ${delayMs/1000}s…`);
      if (attempt === maxRetries) {
        console.error('❌ Cannot connect to RabbitMQ:', err);
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, delayMs));
    }
  }

  ch.prefetch(1);
  console.log('Worker waiting for messages…');
  ch.consume(
    queue,
    msg => {
      const { task } = JSON.parse(msg.content.toString());
      console.log('→ Received task:', task);

      setTimeout(() => {
        console.log('✔ Done:', task);
        ch.ack(msg);
      }, 1000);
    },
    { noAck: false }
  );
}

init().catch(err => {
  console.error('Worker initialization error:', err);
  process.exit(1);
});
