import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Buffer } from 'buffer';

window.Buffer = Buffer;

// Apply saved theme and background on load
const savedTheme = localStorage.getItem('pingme-theme');
if (savedTheme) document.body.classList.add(savedTheme);

const savedBg = localStorage.getItem('pingme-bg');
if (savedBg) document.body.classList.add(savedBg);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
