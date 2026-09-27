import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import WorkspaceAuth from './components/WorkspaceAuth.jsx';
import { ThemeProvider } from './components/WorkspaceUI.jsx';
import { MotionConfig } from 'framer-motion';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <WorkspaceAuth>
          <App />
        </WorkspaceAuth>
      </MotionConfig>
    </ThemeProvider>
  </React.StrictMode>
);
