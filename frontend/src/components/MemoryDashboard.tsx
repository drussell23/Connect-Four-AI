/**
 * 📊 Memory Dashboard Component
 * 
 * Real-time visualization of M1 optimization metrics
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import './MemoryDashboard.css';

interface DashboardMetrics {
  timestamp: number;
  memory: {
    heap: { usedMB: number; totalMB: number; percentage: number };
    system: { usedMB: number; freeMB: number; percentage: number };
    pressure: string;
  };
  tensorflow: {
    backend: string;
    numTensors: number;
    numBytes: number;
    modelCount: number;
  };
  caches: {
    total: { entries: number; memoryMB: number; hitRate: number };
  };
  ai: {
    currentMode: string;
    offloadEnabled: boolean;
    inferenceDevice: string;
  };
  background: {
    tasksQueued: number;
    tasksRunning: number;
    isPaused: boolean;
  };
  degradation: {
    level: string;
    rateLimits: { requestsPerSecond: number };
    activeClients: number;
  };
  phases: { [key: string]: boolean };
}

interface StressTestConfig {
  durationMs: number;
  concurrentGames: number;
  aiRequestsPerSecond: number;
  targetMemoryPressure: string;
}

const PRESSURE_COLORS: Record<string, string> = {
  normal: '#10b981',
  moderate: '#f59e0b',
  high: '#ef4444',
  critical: '#991b1b'
};

export const MemoryDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<DashboardMetrics[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'memory' | 'ai' | 'stress'>('overview');
  const [stressTestRunning, setStressTestRunning] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to metrics WebSocket
    const socket = io('http://localhost:3000/metrics', {
      transports: ['websocket'],
      reconnection: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to metrics dashboard');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from metrics dashboard');
      setIsConnected(false);
    });

    socket.on('metrics:update', (data: DashboardMetrics) => {
      setMetrics(data);
      setMetricsHistory(prev => {
        const updated = [...prev, data];
        // Keep last 60 data points (1 minute)
        return updated.slice(-60);
      });
    });

    socket.on('memory:alert', (alert: any) => {
      console.warn('Memory alert:', alert);
      // Could show toast notification
    });

    socket.on('stress:completed', (result: any) => {
      setStressTestRunning(false);
      console.log('Stress test completed:', result);
    });

    // Fetch initial metrics
    fetchCurrentMetrics();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchCurrentMetrics = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/dashboard/metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const startStressTest = async () => {
    const config: StressTestConfig = {
      durationMs: 60000, // 1 minute
      concurrentGames: 10,
      aiRequestsPerSecond: 5,
      targetMemoryPressure: 'high'
    };

    try {
      setStressTestRunning(true);
      const response = await fetch('http://localhost:3000/api/dashboard/stress-test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const result = await response.json();
      console.log('Stress test started:', result);
    } catch (error) {
      console.error('Failed to start stress test:', error);
      setStressTestRunning(false);
    }
  };

  const runEmergencyCleanup = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/emergency/cleanup', {
        method: 'POST'
      });
      const result = await response.json();
      console.log('Emergency cleanup result:', result);
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  };

  if (!metrics) {
    return (
      <div className="memory-dashboard loading">
        <h2>Loading Memory Dashboard...</h2>
      </div>
    );
  }

  const memoryData = metricsHistory.map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    heap: m.memory.heap.percentage,
    system: m.memory.system.percentage
  }));

  const tensorData = metricsHistory.map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    tensors: m.tensorflow.numTensors,
    memoryMB: m.tensorflow.numBytes / 1024 / 1024
  }));

  const phaseData = Object.entries(metrics.phases).map(([phase, enabled]) => ({
    phase: phase.replace(/_/g, ' ').replace(/phase\d+/, '').trim(),
    enabled: enabled ? 1 : 0
  }));

  return (
    <div className="memory-dashboard">
      <div className="dashboard-header">
        <h1>🍎 M1 Memory Dashboard</h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'memory' ? 'active' : ''}
          onClick={() => setActiveTab('memory')}
        >
          Memory
        </button>
        <button 
          className={activeTab === 'ai' ? 'active' : ''}
          onClick={() => setActiveTab('ai')}
        >
          AI & Performance
        </button>
        <button 
          className={activeTab === 'stress' ? 'active' : ''}
          onClick={() => setActiveTab('stress')}
        >
          Stress Testing
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="dashboard-content">
          <div className="metrics-grid">
            <div className={`metric-card pressure-${metrics.memory.pressure}`}>
              <h3>Memory Pressure</h3>
              <div className="metric-value">{metrics.memory.pressure.toUpperCase()}</div>
              <div className="metric-detail">
                Heap: {metrics.memory.heap.percentage.toFixed(1)}% | 
                System: {metrics.memory.system.percentage.toFixed(1)}%
              </div>
            </div>

            <div className={`metric-card degradation-${metrics.degradation.level}`}>
              <h3>Degradation Level</h3>
              <div className="metric-value">{metrics.degradation.level.toUpperCase()}</div>
              <div className="metric-detail">
                {metrics.degradation.rateLimits.requestsPerSecond} req/s | 
                {metrics.degradation.activeClients} clients
              </div>
            </div>

            <div className="metric-card">
              <h3>AI Mode</h3>
              <div className="metric-value">{metrics.ai.currentMode.toUpperCase()}</div>
              <div className="metric-detail">
                Device: {metrics.ai.inferenceDevice} | 
                Offload: {metrics.ai.offloadEnabled ? 'ON' : 'OFF'}
              </div>
            </div>

            <div className="metric-card">
              <h3>Background Tasks</h3>
              <div className="metric-value">
                {metrics.background.tasksRunning} / {metrics.background.tasksQueued}
              </div>
              <div className="metric-detail">
                {metrics.background.isPaused ? 'PAUSED' : 'ACTIVE'}
              </div>
            </div>
          </div>

          <div className="phase-status">
            <h3>M1 Optimization Phases</h3>
            <div className="phase-grid">
              {phaseData.map((phase, idx) => (
                <div 
                  key={idx} 
                  className={`phase-indicator ${phase.enabled ? 'enabled' : 'disabled'}`}
                >
                  Phase {idx}: {phase.phase}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="dashboard-content">
          <div className="chart-container">
            <h3>Memory Usage Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={memoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="heap" 
                  stroke="#8884d8" 
                  name="Heap %" 
                />
                <Line 
                  type="monotone" 
                  dataKey="system" 
                  stroke="#82ca9d" 
                  name="System %" 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>TensorFlow Memory</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={tensorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="tensors"
                  stroke="#8884d8"
                  fill="#8884d8"
                  name="Tensor Count"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="memoryMB"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  name="Memory (MB)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="memory-details">
            <div className="detail-card">
              <h4>Heap Memory</h4>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${metrics.memory.heap.percentage}%`,
                    backgroundColor: PRESSURE_COLORS[metrics.memory.pressure]
                  }}
                />
              </div>
              <p>{metrics.memory.heap.usedMB.toFixed(1)} / {metrics.memory.heap.totalMB.toFixed(1)} MB</p>
            </div>

            <div className="detail-card">
              <h4>Cache Memory</h4>
              <p>Total Entries: {metrics.caches.total.entries.toLocaleString()}</p>
              <p>Memory: {metrics.caches.total.memoryMB.toFixed(1)} MB</p>
              <p>Hit Rate: {(metrics.caches.total.hitRate * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="dashboard-content">
          <div className="ai-status">
            <h3>AI Configuration</h3>
            <table className="status-table">
              <tbody>
                <tr>
                  <td>Current Mode:</td>
                  <td className={`mode-${metrics.ai.currentMode}`}>
                    {metrics.ai.currentMode}
                  </td>
                </tr>
                <tr>
                  <td>Inference Device:</td>
                  <td>{metrics.ai.inferenceDevice.toUpperCase()}</td>
                </tr>
                <tr>
                  <td>Python Offload:</td>
                  <td>{metrics.ai.offloadEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
                </tr>
                <tr>
                  <td>TensorFlow Backend:</td>
                  <td>{metrics.tensorflow.backend}</td>
                </tr>
                <tr>
                  <td>Active Models:</td>
                  <td>{metrics.tensorflow.modelCount}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="action-buttons">
            <button 
              onClick={runEmergencyCleanup}
              className="emergency-button"
            >
              🚨 Emergency Cleanup
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stress' && (
        <div className="dashboard-content">
          <div className="stress-test-controls">
            <h3>Stress Testing</h3>
            <p>Run comprehensive load tests to validate M1 optimizations</p>
            
            <button 
              onClick={startStressTest}
              disabled={stressTestRunning}
              className="stress-test-button"
            >
              {stressTestRunning ? 'Test Running...' : '🧪 Start Stress Test'}
            </button>

            {stressTestRunning && (
              <div className="test-progress">
                <div className="spinner" />
                <p>Stress test in progress...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};