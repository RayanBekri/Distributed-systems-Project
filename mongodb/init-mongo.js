db = db.getSiblingDB('sampledb');

db.testData.insertMany([
    { name: "Test Item 1", value: 100 },
    { name: "Test Item 2", value: 200 }
]);

