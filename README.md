# Distributed-systems-Project

```
docker network create app-network

docker build -t my-mongo ./mongodb

docker run -d --name mongodb --network app-network -p 27017:27017 -e MONGO_INITDB_DATABASE=sampledb my-mongo

docker build -t my-backend ./backend

docker run -d --name backend --network app-network -p 4000:4000 -e DB_HOST=mongodb -e DB_PORT=27017 -e DB_NAME=sampledb my-backend
  
docker build -t my-frontend ./frontend

docker run -d --name frontend --network app-network -p 3000:80 my-frontend
```