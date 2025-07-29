# Service Integration Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Communication Flow](#communication-flow)
4. [Service Status Broadcasting System](#service-status-broadcasting-system)
5. [Event-Driven Architecture](#event-driven-architecture)
6. [WebSocket Communication Patterns](#websocket-communication-patterns)
7. [Health Monitoring System](#health-monitoring-system)
8. [Frontend Integration](#frontend-integration)
9. [Troubleshooting Guide](#troubleshooting-guide)

## Overview

The Connect Four AI platform uses a sophisticated microservices architecture with real-time service integration. The system ensures all services work together seamlessly while maintaining their independence through an event-driven architecture and real-time status broadcasting.

### Key Features
- **Real-time Service Status Broadcasting**: Instant updates of service health to all connected clients
- **Event-Driven Communication**: Decoupled services communicate through events
- **Automatic Health Monitoring**: Continuous health checks with automatic status updates
- **WebSocket & HTTP Hybrid**: Combines WebSocket for real-time updates with HTTP for reliability
- **Fault Tolerance**: Automatic reconnection and fallback mechanisms

## Architecture Components

### 1. Service Integration Orchestrator
**Location**: `/backend/src/integration/service-integration-orchestrator.ts`

The heart of the integration system that:
- Manages connections to all microservices
- Monitors service health via HTTP endpoints
- Broadcasts status updates through EventEmitter2
- Coordinates cross-service communication
- Runs background AI simulations

### 2. Game Gateway
**Location**: `/backend/src/game/game.gateway.ts`

WebSocket gateway that:
- Receives service status events from EventEmitter2
- Broadcasts status updates to all connected frontend clients
- Handles game-related WebSocket events
- Acts as the bridge between backend events and frontend

### 3. Integration WebSocket Gateway
**Location**: `/backend/src/integration/integration-websocket.gateway.ts`

Dedicated gateway for inter-service communication:
- Runs on port 8888
- Manages service-to-service WebSocket connections
- Handles pattern sharing and model updates
- Facilitates real-time data flow between services

### 4. Frontend Integration Logger
**Location**: `/frontend/src/utils/integrationLogger.ts`

Frontend utility that:
- Receives and processes service status updates
- Provides detailed console logging with visual indicators
- Maintains service status state
- Offers debugging capabilities

## Communication Flow

### Service Status Update Flow

```
1. Service Health Check (Backend)
   ↓
2. ServiceIntegrationOrchestrator.checkAllServicesHealth()
   - HTTP GET to each service's /health endpoint
   - Updates internal serviceStatus Map
   ↓
3. ServiceIntegrationOrchestrator.broadcastServiceStatus()
   - Compiles status for all services
   - Emits 'service.status.update' event
   ↓
4. EventEmitter2 (Internal Event Bus)
   - Propagates event through NestJS event system
   ↓
5. GameGateway.handleServiceStatusUpdate()
   - Receives event via @OnEvent decorator
   - Broadcasts to all Socket.IO clients
   ↓
6. Frontend App.tsx
   - Listens for 'serviceStatusUpdate' event
   - Logs status and updates UI
   ↓
7. IntegrationLogger.updateServiceStatuses()
   - Updates internal state
   - Displays visual status in console
```

## Service Status Broadcasting System

### Backend Implementation

```typescript
// service-integration-orchestrator.ts
private broadcastServiceStatus(): void {
    const statusUpdate = {
        ml_service: this.serviceStatus.get('ml_service') || false,
        ml_inference: this.serviceStatus.get('ml_inference') || false,
        continuous_learning: this.serviceStatus.get('continuous_learning') || false,
        ai_coordination: this.serviceStatus.get('ai_coordination') || false,
        python_trainer: this.serviceStatus.get('python_trainer') || false,
        integration_websocket: this.serviceStatus.get('integration_websocket') || false,
    };
    
    // Emit to internal event bus
    this.eventEmitter.emit('service.status.update', statusUpdate);
}
```

### Event Bridge (Game Gateway)

```typescript
// game.gateway.ts
@OnEvent('service.status.update')
handleServiceStatusUpdate(payload: any) {
    // Broadcast to all connected Socket.IO clients
    this.server.emit('serviceStatusUpdate', payload);
}
```

### Frontend Reception

```typescript
// App.tsx
socket.on('serviceStatusUpdate', (data: any) => {
    console.log('📊 Service status update:', data);
    integrationLogger.updateServiceStatuses(data);
});
```

## Event-Driven Architecture

### Event Categories

1. **Service Events**
   - `service.status.update`: Service health status changes
   - `service.connected`: New service comes online
   - `service.disconnected`: Service goes offline

2. **Game Events**
   - `game.started`: New game begins
   - `game.move.made`: Player or AI makes a move
   - `game.ended`: Game completes

3. **AI Events**
   - `ai.move.requested`: AI calculation requested
   - `ai.move.decided`: AI move determined
   - `ai.pattern.detected`: Pattern recognized

4. **Learning Events**
   - `learning.model.updated`: ML model improved
   - `learning.insight.generated`: New strategy discovered

### Event Flow Example

```
User Makes Move → game.move.made event → Multiple handlers:
  ├─ ML Service: Analyzes board position
  ├─ Continuous Learning: Detects patterns
  ├─ AI Coordination: Updates strategy
  └─ Integration Logger: Records event
```

## WebSocket Communication Patterns

### Service-to-Service WebSocket

**Continuous Learning WebSocket** (Port 8005):
```typescript
// Orchestrator connects to CL service
this.continuousLearningWebSocket = new WebSocket('ws://localhost:8005');

// Subscribe to updates
this.sendToContinuousLearning({
    type: 'subscribe',
    topics: ['model_updates', 'pattern_insights', 'learning_progress'],
});
```

**AI Coordination WebSocket** (Port 8003):
```typescript
// Register with coordination hub
this.sendToAICoordination({
    type: 'register',
    service: 'backend_orchestrator',
    capabilities: {
        simulation: true,
        realtime_analysis: true,
        pattern_detection: true,
    },
});
```

### Client-to-Backend WebSocket

**Game Gateway** (Port 3000):
- Handles game moves and status updates
- Uses Socket.IO for browser compatibility
- Automatic reconnection on disconnect

## Health Monitoring System

### Health Check Mechanism

1. **Periodic Health Checks**
   ```typescript
   private startHealthMonitoring(): void {
       setInterval(async () => {
           await this.checkAllServicesHealth();
       }, 30000); // Every 30 seconds
   }
   ```

2. **Service Health Endpoints**
   - ML Service: `http://localhost:8000/health`
   - ML Inference: `http://localhost:8001/health`
   - Continuous Learning: `http://localhost:8002/health`
   - AI Coordination: `http://localhost:8003/health`
   - Python Trainer: `http://localhost:8004/health`

3. **Health Response Format**
   ```json
   {
       "status": "healthy",
       "service": "service_name",
       "timestamp": 1234567890,
       "details": {
           "uptime": 3600,
           "connections": 5,
           "queue_size": 0
       }
   }
   ```

### Failure Handling

- **HTTP Timeout**: 5 seconds per health check
- **Retry Logic**: Automatic retry on connection failure
- **Status Propagation**: Immediate broadcast on status change
- **WebSocket Reconnection**: 5-second delay between attempts

## Frontend Integration

### Service Status Display

The frontend displays service status in the console with visual indicators:

```
📊 Service Integration Status
┌─────────────────────────┬────────┬──────────────────┬────────┐
│ Service                 │ Port   │ Status           │ Health │
├─────────────────────────┼────────┼──────────────────┼────────┤
│ Backend API             │ 3000   │ ✅ Connected     │ 🟢     │
│ ML Service              │ 8000   │ ✅ Connected     │ 🟢     │
│ ML Inference            │ 8001   │ ✅ Connected     │ 🟢     │
│ AI Coordination         │ 8003   │ ✅ Connected     │ 🟢     │
│ Continuous Learning     │ 8002   │ ✅ Connected     │ 🟢     │
│ Python Trainer          │ 8004   │ ❌ Disconnected  │ 🔴     │
│ Integration WebSocket   │ 8888   │ ✅ Connected     │ 🟢     │
└─────────────────────────┴────────┴──────────────────┴────────┘
```

### Console Commands

Available in browser console:
- `integrationLogger.showDashboard()` - Display full status dashboard
- `integrationLogger.getServiceSummary()` - Show service status table
- `integrationLogger.toggleDetailedMode()` - Toggle verbose logging
- `integrationLogger.getRecentEvents(20)` - View recent events

## Troubleshooting Guide

### Common Issues

1. **"Services show as disconnected in frontend"**
   - Check if backend is broadcasting status updates
   - Verify GameGateway is handling `service.status.update` events
   - Ensure frontend is listening for `serviceStatusUpdate` events

2. **"ML Service not connecting"**
   - Verify ML service is running on port 8000
   - Check CORS configuration in ML service
   - Ensure health endpoint returns proper response

3. **"Continuous Learning WebSocket fails"**
   - Confirm CL WebSocket is on port 8005 (not 8002)
   - Check that HTTP health endpoint is on port 8002
   - Verify CORS headers in health endpoint

### Debug Commands

```bash
# Check all services
npm run status

# View service logs
npm run logs:backend
npm run logs:ml

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8002/health
curl http://localhost:8003/health
```

### Service Dependencies

```
Frontend (3001)
    ↓
Backend API (3000)
    ├─ ML Service (8000) - HTTP only
    ├─ ML Inference (8001) - HTTP only
    ├─ Continuous Learning (8002 HTTP, 8005 WS)
    ├─ AI Coordination (8003) - HTTP + WS
    ├─ Python Trainer (8004) - HTTP only
    └─ Integration WebSocket (8888) - WS only
```

## Key Implementation Details

### Why Status Updates Work

1. **Backend Orchestrator** performs health checks every 30 seconds
2. **EventEmitter2** propagates status changes internally
3. **Game Gateway** bridges internal events to Socket.IO
4. **Frontend** receives updates via WebSocket subscription
5. **Integration Logger** displays visual status in console

### Critical Code Paths

1. **Status Update Chain**:
   - `checkAllServicesHealth()` → `broadcastServiceStatus()` → `emit('service.status.update')` → `handleServiceStatusUpdate()` → `socket.emit('serviceStatusUpdate')`

2. **WebSocket Connections**:
   - Each service has specific connection logic
   - Automatic reconnection on failure
   - Status updates on connection state changes

3. **Health Monitoring**:
   - HTTP-based for reliability
   - Timeout handling for unresponsive services
   - Immediate status broadcast on changes

This architecture ensures real-time visibility into the health and status of all microservices, enabling quick debugging and monitoring of the distributed system.