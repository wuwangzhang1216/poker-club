
import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Corrected import for App component. The error was due to App.tsx being an invalid module.
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
