import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPreferences, loadPreferences } from './userPreferences';
import App from './App';
import './styles.css';
import './theme.css';

applyPreferences(loadPreferences());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
