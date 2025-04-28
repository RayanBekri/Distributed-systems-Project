# Distributed Systems Project

A fully containerized distributed system demonstrating:

- **Message‐Oriented Architecture** with RabbitMQ (Producer/Consumer)  
- **Horizontal Scaling** of backend microservices behind an NGINX load balancer  
- **MongoDB Replica Set** for high availability  
- **Fault Tolerance**, health checks, and persistence via Docker volumes  

---

## Table of Contents

1. [Prerequisites](#prerequisites)  
2. [Folder Structure](#folder-structure)  
3. [Quick Start (Docker Compose)](#quick-start-docker-compose)  
4. [Service Overview & Ports](#service-overview--ports)  
5. [Component Details](#component-details)  
   - [MongoDB Replica Set](#mongodb-replica-set)  
   - [RabbitMQ Broker](#rabbitmq-broker)  
   - [Backend Microservices](#backend-microservices)  
   - [Worker Service](#worker-service)  
   - [Load Balancer (NGINX)](#load-balancer-nginx)  
   - [Frontend UI](#frontend-ui)  
6. [Scaling & Health](#scaling--health)  
7. [Logs & Monitoring](#logs--monitoring)  
8. [Troubleshooting](#troubleshooting)  

---

## Prerequisites

- Docker ≥ 20.10  
- Docker Compose ≥ 1.29  
- (Optional) `mongosh` for manual MongoDB inspection  

---

## Folder Structure

```
.
├── backend/                 # Multi‐service backend
│   ├── Dockerfile
│   ├── package.json
│   └── services/
│       ├── getall/server.js
│       ├── getone/server.js
│       ├── create/server.js
│       └── update/server.js
│
├── worker/                  # RabbitMQ consumer
│   ├── Dockerfile
│   ├── package.json
│   └── worker.js
│
├── nginx/                   # Load balancer
│   ├── Dockerfile
│   └── nginx.conf
│
├── frontend/                # Static HTML UI (served by NGINX)
│   ├── Dockerfile
│   ├── default.conf
│   └── index.html
│
├── db/                      # MongoDB init scripts
│   └── init-replica-set.sh
│
└── docker-compose.yml       # Orchestrates everything
└── README.md                # ← You are here
```

---

## Quick Start (Docker Compose)

1. **Clone the repo**  
   ```bash
   git clone <your-repo-url>
   cd Distributed-systems-Project
   ```

2. **Start all services**  
   ```bash
   docker network create ds-net
   docker volume create mongo-primary-data
   docker volume create mongo-replica1-data
   docker volume create mongo-replica2-data
   docker volume create rabbitmq_data
   docker-compose up -d
   ```

3. **Wait for initialization**  
   - Mongo replica set is auto-initiated by `init-replica-set.sh`  
   - RabbitMQ healthcheck will pass once the broker is ready  
   - Backend, worker, load-balancer, and frontend will come online  

---

## Service Overview & Ports

| Service           | Host Port → Container Port | URL / Notes                          |
|-------------------|-----------------------------|--------------------------------------|
| **Frontend**      | `8080 → 80`                 | http://localhost:8080                |
| **NGINX LB**      | _none exposed_              | _Receives from frontend_             |
| **Backends**      | internal ports `4000–4003`  | `/health` on each service            |
| **Worker**        | _none exposed_              | Consumes RabbitMQ `task_queue`       |
| **RabbitMQ UI**   | `15672 → 15672`             | http://localhost:15672 (user/password) |
| **MongoDB Primary**   | _none exposed_         | Replica set member                   |
| **MongoDB Replica1**  | _none exposed_         | Replica set member                   |
| **MongoDB Replica2**  | _none exposed_         | Replica set member                   |

---

## Component Details

### MongoDB Replica Set

- Three containers: `mongo-primary`, `mongo-replica1`, `mongo-replica2`  
- Init script `db/init-replica-set.sh`:
  1. Waits for primary to come online  
  2. Runs `rs.initiate(...)` to form `rs0`  
  3. Polls `rs.status().ok` until healthy  
  4. Creates `sampledb.testData` collection  
- Data persisted in named volumes  

### RabbitMQ Broker

- Single container `rabbitmq:3-management`  
- UI on 15672 with default `user` / `password`  
- Durable queue `task_queue`  
- Healthcheck ensures broker readiness  

### Backend Microservices

- Four independent services under `backend/services/...`:
  - **getall** – `GET /api/testdata`  
  - **getone** – `GET /api/testdata/:value`  
  - **create** – `POST /api/testdata`  
  - **update** – `POST /api/testdata/update/:value`  
- Each:
  - Reads `PORT` & `INSTANCE` from env  
  - Connects (with retries) to MongoDB primary  
  - Connects (with retries) to RabbitMQ, asserts queue  
  - Enqueues a JSON payload `{ service, instance, ip, ... }` on each API call  
  - Exposes a `/health` endpoint returning `OK:<INSTANCE>`  

### Worker Service

- `worker.js`:
  - Connects to RabbitMQ with up to 5 retries  
  - `prefetch(1)` + durable ack  
  - Logs every received payload and writes to `worker.log` inside container  
- No external ports exposed  

### Load Balancer (NGINX)

- Reads dynamic DNS (`resolver 127.0.0.11`)  
- Defines 4 upstream blocks—one per microservice  
- Routes:
  - `/api/testdata` → `getall`  
  - `/api/testdata/:value` → `getone`  
  - `/api/testdata` (POST) → `create`  
  - `/api/testdata/update` → `update`  
- Healthchecks upstream automatically via Docker‐injected DNS  

### Frontend UI

- Static `index.html` served by `nginx` on port 80  
- All `/api/` calls proxied to the load-balancer service at `loadbalancer:80`  

---

## Scaling & Health

- **Horizontal scaling**:  
  ```bash
  docker-compose up -d --scale backend-getall=3
  ```
- **Health endpoints**:  
  - Backends: `curl http://<container>:<port>/health`  
  - RabbitMQ: UI or `rabbitmq-diagnostics ping`  
  - Mongo: `docker exec mongo-primary mongosh --eval "rs.status()"`  

---

## Logs & Monitoring

- **RabbitMQ UI**: http://localhost:15672  
- **Mongo status**:  
  ```bash
  docker exec mongo-primary mongosh --eval "rs.status()"
  ```  
- **Worker logs**:
  ```bash
  docker logs worker
  docker exec worker tail -n 100 /usr/src/app/worker.log
  ```  
- **Backend logs**:
  ```bash
  docker-compose logs backend-getall
  ```  

---

## Troubleshooting

- **“host not found” in NGINX**  
  - Confirm `depends_on:` and shared `ds-net` network  
- **Replica‐set stuck**  
  - Check `init-replica-set.sh` ran to completion  
  - Inspect logs: `docker logs mongo-init`  
- **RabbitMQ connection errors**  
  - Ensure broker health is `OK` before backends start  
  - Backends retry 5× with 5s delay  

---

