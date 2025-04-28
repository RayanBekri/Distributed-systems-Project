#!/usr/bin/env bash
set -euxo pipefail

PRIMARY=${MONGO_PRIMARY:-mongo-primary}
REPLICA1=${MONGO_REPLICA1:-mongo-replica1}
REPLICA2=${MONGO_REPLICA2:-mongo-replica2}

echo "⏳ waiting for ${PRIMARY}:27017 to accept connections…"
until mongosh --host "${PRIMARY}" --eval "db.adminCommand('ping')" &>/dev/null; do
  sleep 1
done

echo "🚀 initiating replica set rs0…"
mongosh --host "${PRIMARY}" <<EOF
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "${PRIMARY}:27017" },
    { _id: 1, host: "${REPLICA1}:27017" },
    { _id: 2, host: "${REPLICA2}:27017" }
  ]
});
EOF

echo "⏳ waiting for replica set to become healthy…"
while true; do
  OK=$(mongosh --quiet --host "${PRIMARY}" --eval "rs.status().ok")
  if [ "$OK" = "1" ]; then
    echo "✅ replica set is healthy!"
    break
  fi
  sleep 1
done

echo "🔨 creating sampledb and its collection…"
mongosh --host "${PRIMARY}" <<EOF
use sampledb;
db.createCollection("testData");
EOF

echo "✅ sampledb created (with testData collection)."
