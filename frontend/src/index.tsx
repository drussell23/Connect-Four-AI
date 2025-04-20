import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tailwind.css';
import App from './App';  // import your App component

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

// React 18+ createRoot API
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
