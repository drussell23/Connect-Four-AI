// frontend/src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';  // your Tailwind setup
import { initializeErrorSuppression } from './utils/errorSuppression';

// Initialize error suppression before anything else
initializeErrorSuppression();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />  {/* App takes no props */}
  </React.StrictMode>
);
