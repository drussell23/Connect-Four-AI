# Console Logging Guide for Service Integration

This guide explains the detailed console logging system that has been integrated into the Connect Four AI application to monitor all service interactions.

## Overview

The application now includes comprehensive console logging that tracks:
- Service connections and health status
- WebSocket events (incoming and outgoing)
- AI decision-making processes with metrics
- Integration events between services
- Performance metrics and latency
- Learning system updates

## Key Features

### 1. Automatic Service Monitoring

When you open the browser console, you'll see:
- Initial service status dashboard
- Real-time connection status updates
- Health check results every 30 seconds
- Performance metrics for each service

### 2. Console Commands

The following objects are available in the browser console:

```javascript
// View the integration dashboard
window.integrationLogger.showDashboard()

// Get service summary
window.integrationLogger.getServiceSummary()

// Test all service integrations
window.serviceHealthMonitor.testIntegration()

// Toggle detailed logging mode
window.integrationLogger.toggleDetailedMode()

// View recent events
window.integrationLogger.getRecentEvents(20)

// Export event history as JSON
window.integrationLogger.exportEvents()
```

### 3. Keyboard Shortcuts

- **Ctrl/Cmd + Shift + D**: Show integration dashboard
- **Ctrl/Cmd + Shift + T**: Test all service integrations
- **Ctrl/Cmd + Shift + L**: Toggle detailed logging mode

### 4. Event Types Logged

#### Service Connections
```
✅ Backend API connected
✅ ML Service connected
❌ AI Coordination disconnected
```

#### WebSocket Events
```
📤 WS OUT: dropDisc {column: 3, gameId: "abc123"}
📥 WS IN: aiMove {column: 4, confidence: 0.95}
```

#### AI Decision Analysis
```
🤖 AI Decision Analysis
Column: 4
Confidence: 95.2%
Algorithm: minimax
Difficulty: 5
Latency: 123ms
Strategy: defensive
Alternative Moves:
  Column 3: Score 0.82
  Column 5: Score 0.71
```

#### Performance Metrics
```
📊 ML Service Performance - Response: 45ms
📊 Backend API Performance - Response: 12ms
```

#### Learning Events
```
🔍 PATTERN DETECTED
Event: pattern_detected
Details: {pattern: "trap_formation", strength: 0.85}

🔄 MODEL UPDATED
Event: model_updated
Details: {improvement: 0.023, games_trained: 150}
```

## Service Health Monitoring

The application monitors these services:
- **Backend API** (Port 3000)
- **ML Service** (Port 8000)
- **ML Inference** (Port 8001)
- **Continuous Learning** (Port 8002)
- **AI Coordination** (Port 8003)
- **Python Trainer** (Port 8004)
- **Integration WebSocket** (Port 8888)

## Color Coding

Console logs use color coding for quick identification:
- 🟢 **Green**: Successful connections and operations
- 🔵 **Blue**: Informational messages
- 🟠 **Orange**: Warnings or slower responses
- 🔴 **Red**: Errors or disconnections
- 🟣 **Purple**: AI-specific events

## Debugging Tips

1. **Check Service Health**: Run `window.serviceHealthMonitor.testIntegration()` to verify all services are responding

2. **Monitor AI Decisions**: Watch for `🤖 AI Decision Analysis` logs to understand AI behavior

3. **Track Performance**: Look for `📊 Performance` logs to identify slow services

4. **Export History**: Use `window.integrationLogger.exportEvents()` to save event history for analysis

5. **Filter Events**: Use browser console filters to focus on specific event types

## Example Session

```javascript
// 1. Check current status
window.integrationLogger.showDashboard()

// 2. Test all integrations
window.serviceHealthMonitor.testIntegration()

// 3. Play a game and watch the logs
// You'll see:
// - WebSocket events for moves
// - AI thinking process
// - Performance metrics
// - Integration events

// 4. Review what happened
window.integrationLogger.getRecentEvents(50)

// 5. Export for analysis
const events = window.integrationLogger.exportEvents()
console.save(events, 'integration-log.json')
```

## Troubleshooting

If services appear disconnected:
1. Check that all services are running: `npm run status`
2. Test integration: `Ctrl/Cmd + Shift + T`
3. Check browser console for specific error messages
4. Restart services if needed: `npm run restart:all`

## Advanced Usage

For developers who want to add custom logging:

```javascript
// Log a custom integration event
integrationLogger.logIntegrationEvent(
  'CustomService',
  'Backend',
  'custom_event',
  { data: 'example' }
)

// Log custom performance metrics
integrationLogger.logPerformanceMetrics({
  service: 'CustomService',
  responseTime: 150,
  queueSize: 5
})
```