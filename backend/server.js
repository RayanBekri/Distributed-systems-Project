const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 4000;

app.use(bodyParser.json());

const dbHost = process.env.DB_HOST || 'mongodb';
const dbPort = process.env.DB_PORT || 27017;
const dbName = process.env.DB_NAME || 'sampledb';
const url = `mongodb://${dbHost}:${dbPort}`;

let db;

MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    db = client.db(dbName);
    console.log(`Connected to MongoDB database: ${dbName}`);
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });

app.get('/api/testdata', async (req, res) => {
  try {
    const data = await db.collection('testData').find().toArray();
    res.json(data);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.get('/api/testdata/:value', async (req, res) => {
  try {
    const value = parseInt(req.params.value);
    const data = await db.collection('testData').findOne({ value });
    if (data) {
      res.json(data);
    } else {
      res.status(404).send('Item not found');
    }
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.post('/api/testdata', async (req, res) => {
  try {
    const newData = req.body;
    const result = await db.collection('testData').insertOne(newData);
    res.json(result.ops[0]);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.post('/api/testdata/update/:value', async (req, res) => {
  try {
    const value = parseInt(req.params.value);
    const updateData = req.body;
    const result = await db.collection('testData').findOneAndUpdate(
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
