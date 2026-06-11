# C7'Beauty

Application web développée avec Vue.js 3 (frontend) et Node.js/Express/MongoDB (backend).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Vue.js 3, TypeScript, Vite, Pinia, Vue Router |
| Backend | Node.js, Express.js |
| Base de données | MongoDB |
| Auth | JWT |
| Infra | Docker, Docker Compose |

## Structure

```
├── frontend/            # Vue.js 3 + TypeScript
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── router/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── views/
│   └── Dockerfile
├── backend/             # Node.js + Express
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── Dockerfile
└── docker-compose.yml
```

## Démarrage avec Docker (dev)

```sh
docker compose up -d
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:3000

## Déploiement production

Ports réservés sur le serveur (127.0.0.1 uniquement) :

| Service  | Port hôte | Conteneur |
|----------|-----------|-----------|
| Frontend | **8092**  | 80        |
| Backend  | **3004**  | 3000      |
| MongoDB  | interne   | 27017     |

```sh
# 1. Cloner / pull sur le serveur
cd /chemin/vers/c7beauty

# 2. Config backend
cp backend/.env.prod.example backend/.env
# Éditer JWT_SECRET (openssl rand -hex 32)

# 3. Build & lancer
docker compose -f docker-compose.prod.yml -p c7beauty-prod up -d --build

# 4. Vérifier
docker compose -f docker-compose.prod.yml -p c7beauty-prod ps
curl -s http://127.0.0.1:8092/ | head
curl -s http://127.0.0.1:8092/api/categories | head
```

Reverse proxy Nginx hôte → voir `deploy/nginx-vhost.example.conf` (pointer le domaine vers `127.0.0.1:8092`).

Mise à jour :

```sh
git pull
docker compose -f docker-compose.prod.yml -p c7beauty-prod up -d --build
```

## Démarrage sans Docker

### Backend

```sh
cd backend
cp .env.example .env
npm install
node server.js
```

### Frontend

```sh
cd frontend
npm install
npm run dev
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:3000
