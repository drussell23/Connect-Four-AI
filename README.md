# Connect Four

![License: MIT](https://img.shields.io/badge/license-MIT-green) ![Node.js](https://img.shields.io/badge/node.js->=16-blue) ![Python](https://img.shields.io/badge/python->=3.8-yellow)

A modern, animated, web-based Connect Four game where you challenge a continually learning AI opponent in real‑time. Enjoy smooth animations, sound effects, and intuitive controls, all backed by a scalable Socket.IO/NestJS backend and a Python ML inference/training service.

---

## Table of Contents

* [Project Overview](#project-overview)
* [Features](#features)
* [Architecture & Tech Stack](#architecture--tech-stack)
* [Prerequisites](#prerequisites)
* [Installation & Setup](#installation--setup)

  * [Environment Variables](#environment-variables)
  * [Docker Setup](#docker-setup)
* [Development](#development)
* [Testing](#testing)
* [Deployment](#deployment)
* [Roadmap](#roadmap)
* [Troubleshooting](#troubleshooting)
* [Contributing](#contributing)
* [License](#license)

---

## Project Overview

Connect Four is a fully client/server multiplayer board game implemented as a single‑page React application. Players drop colored discs into a seven‑column, six‑row grid, aiming to connect four of their own color in a row, column, or diagonal. An AI opponent, served over a separate ML pipeline, responds to moves in real‑time, with the model continuously updated via self‑play and human versus AI logs.

## Features

* **Smooth Animations**: CSS keyframes for disc drops, bounce effects, and slide‑in move history panel.
* **Sound & Haptics**: Click, drop, and victory chimes; optional device vibration on supported platforms.
* **Real‑Time Play**: Bi‑directional updates via Socket.IO (WebSocket transport) using a NestJS gateway.
* **Adaptive AI**: Python‑based inference service (FastAPI/Uvicorn) with PyTorch/TensorFlow, supporting both self‑play training and on‑the‑fly move generation.
* **Responsive UI**: Tailwind CSS ensures usability on desktop, tablet, and mobile screen sizes.
* **Move History**: Sidebar logs every move, with timestamps and undo/redo support.
* **Configuration**: Customize board size, winning length, and AI difficulty via environment flags.

## Architecture & Tech Stack

```plaintext
┌────────────┐      WebSocket      ┌─────────────┐      HTTP       ┌──────────────┐
│ Frontend   │ ⟷ (Socket.IO) ⟷   │ NestJS WS   │ ⟷ (REST/gRPC) ⟷ │ ML Inference │
│ React+TS   │                    │ Gateway     │                  │ FastAPI📡    │
└────────────┘                    └─────────────┘                  └──────────────┘
```

* **Frontend**: React (TypeScript), Tailwind CSS, Socket.IO‑client
* **Backend**: NestJS, Socket.IO (WebSocket only), TypeScript
* **AI Service**: FastAPI/Uvicorn, Python 3.8+, PyTorch/TensorFlow
* **CI/CD & DevOps**: GitHub Actions, Docker Compose, Poetry or pip

## Prerequisites

* **Node.js** ≥ v16.x and npm or Yarn
* **Python** ≥ 3.8 and pip (or Poetry)
* **Docker** & **Docker Compose** (optional but recommended)
* **Git** and Bash shell (or WSL/macOS Terminal)

## Installation & Setup

1. **Clone repository**

   ```bash
   git clone https://github.com/drussell23/Connect-Four.git
   cd Connect-Four
   ```

2. **Install dependencies**

   ```bash
   # Frontend
   cd frontend && npm install && cd ..

   # Backend
   cd backend && npm install && cd ..

   # AI/ML service
   cd ml_service && poetry install || pip install -r requirements.txt && cd ..
   ```

### Environment Variables

Create `.env` files in each service directory:

**frontend/.env**

```
REACT_APP_WS_URL=http://localhost:3000/game
REACT_APP_API_URL=http://localhost:3000
```

**backend/.env**

```
PORT=3000
WS_NAMESPACE=/game
CORS_ORIGINS=http://localhost:3001
```

**ml\_service/.env**

```
HOST=0.0.0.0
PORT=8000
MODEL_PATH=./models/current_model.pt
SELF_PLAY_DIR=./data/selfplay
```

### Docker Setup (Optional)

You can run all services via Docker Compose:

```bash
# From project root
docker-compose up --build
```

* **frontend**: [http://localhost:3001](http://localhost:3001)
* **backend**: [http://localhost:3000](http://localhost:3000)
* **ml\_service**: [http://localhost:8000](http://localhost:8000)

## Development

### Running Locally

```bash
# Terminal 1: Start backend
cd backend && npm run start:dev

# Terminal 2: Start frontend (disable HTTPS if needed)
cd frontend
export HTTPS=false
npm start

# Terminal 3: Start ML inference
cd ml_service
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
```

### AI Training Modes

* **Offline self‑play**:

  ```bash
  ./scripts/run_pipeline.sh offline
  ```
* **Serve‑only inference** (for UI testing):

  ```bash
  ./scripts/run_pipeline.sh serve --serve
  ```
* **Continuous training**:

  ```bash
  ./scripts/run_pipeline.sh continuous
  ```
* **Hybrid mode** (self‑play + serve):

  ```bash
  ./scripts/run_pipeline.sh both --serve --interval 5
  ```

## Testing

* **Frontend**: Jest & React Testing Library

  ```bash
  cd frontend
  npm test
  ```
* **Backend**: Jest (unit + e2e)

  ```bash
  cd backend
  npm run test
  ```
* **AI Service**: PyTest

  ```bash
  cd ml_service
  pytest
  ```

## Deployment

1. **Build production assets**

   ```bash
   cd frontend && npm run build && cd ..
   ```
2. **Configure environment variables** on your server or CI
3. **Use Docker Compose** or individual service managers (PM2, systemd):

   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

## Roadmap

* Multiplayer (peer‑to‑peer) mode
* Persistent game history & user accounts
* Tournament bracket management UI
* Enhanced AI visualization & explainability
* Mobile app (React Native)

## Troubleshooting

### Port is already in use (EADDRINUSE)

If you see an error like `Error: listen EADDRINUSE: address already in use :::3000`, it means another process is occupying the port the application is trying to use. This can happen if a previous development session did not terminate correctly.

To resolve this, you can use the provided `kill-port` script to free up the required port.

**Usage:**

Run the following command from the root of the project, replacing `<port_number>` with the port(s) you need to clear.

```bash
npm run kill-port -- <port_number_1> <port_number_2>
```

**Examples:**

To kill a single port:
```bash
npm run kill-port -- 3000
```

To kill multiple ports:
```bash
npm run kill-port -- 3000 3002
```

#### Clearing Default Development Ports

For convenience, a `dev:kill` script is available to clear the default backend and frontend ports (3000 and 3002) with a single command:

```bash
npm run dev:kill
```


* **Stuck on “Connecting…”**: Check that both frontend and backend are running on ports 3001/3000, and that your proxy or WS URL matches.
* **CORS errors**: Verify `CORS_ORIGINS` in backend `.env` includes your front‑end origin.
* **Proxy ECONNREFUSED**: Scope CRA proxy to `/socket.io` or disable it if directly hitting port 3000.

## Contributing

1. Fork this repo
2. Create a branch (`git checkout -b feature/awesome`)
3. Commit your changes (`git commit -m "feat: add awesome feature"`)
4. Push to your branch (`git push origin feature/awesome`)
5. Open a Pull Request

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) standard.

## License

This project is licensed under the **MIT License**. See [LICENSE.md](LICENSE.md) for details.
