### 1. Create a private network

```bash
docker network create ds-net
```
- **What it does:** Makes a user‑defined bridge network named `ds-net` so containers can talk by name (e.g. `mongodb`, `rabbitmq`) without exposing ports externally.

---

### 2. Create persistent volumes

```bash
docker volume create mongo_data
docker volume create rabbitmq_data
```
- **What it does:** Allocates two named volumes, `mongo_data` for your MongoDB database files and `rabbitmq_data` for RabbitMQ’s queue data, so they survive container restarts.

---

### 3. Build & run MongoDB (with `init-mongo.js` baked in)

```bash
# Build a custom image from your mongodb/Dockerfile
docker build -t custom-mongo ./mongodb

# Run MongoDB, mounting the data volume and joining ds-net
docker run -d \
  --name mongodb \
  --network ds-net \
  -v mongo_data:/data/db \
  custom-mongo
```
- **Key points:**
  - Uses your `mongodb/Dockerfile` (which COPYs `init-mongo.js` into `/docker-entrypoint-initdb.d/`).
  - On **first** startup, that script seeds `sampledb.testData`.
  - Data persists in `mongo_data`.

---

### 4. Run RabbitMQ (management UI only)

```bash
docker run -d \
  --name rabbitmq \
  --network ds-net \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=user \
  -e RABBITMQ_DEFAULT_PASS=password \
  -v rabbitmq_data:/var/lib/rabbitmq \
  rabbitmq:3-management
```
- **Key points:**
  - Exposes **only** the management UI on `15672`.
  - Credentials set via env vars.
  - Queue data persists in `rabbitmq_data`.

---

### 5. Build & run Backend

```bash
# Build your backend image
docker build -t backend-image ./backend

# Run backend, wiring it to MongoDB & RabbitMQ
docker run -d \
  --name backend \
  --network ds-net \
  -e MONGO_URL="mongodb://mongodb:27017/sampledb" \
  -e RABBITMQ_URL="amqp://user:password@rabbitmq:5672" \
  backend-image
```
- **Key points:**
  - No ports exposed—frontend will call it over the private network.
  - Knows where to find `mongodb` and `rabbitmq`.

---

### 6. Build & run Worker

```bash
# Build your worker image
docker build -t worker-image ./worker

# Run worker on the same network
docker run -d \
  --name worker \
  --network ds-net \
  -e RABBITMQ_URL="amqp://user:password@rabbitmq:5672" \
  worker-image
```
- **Key points:**
  - Listens on `task_queue` and processes jobs.
  - No external ports needed.

---

### 7. Build & run Frontend

```bash
# Build your frontend image
docker build -t frontend-image ./frontend

# Run frontend, exposing port 80 to the host
docker run -d \
  --name frontend \
  --network ds-net \
  -p 80:80 \
  frontend-image
```
- **Key points:**
  - Only the UI is reachable on port 80.
  - It will call `/api/...` on `http://backend:4000` internally.

---

That’s it—each service lives on `ds-net`, Mongo & RabbitMQ data persist via named volumes, and only the frontend (80) and RabbitMQ UI (15672) are exposed externally.