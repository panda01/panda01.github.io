import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const applicationMountElement = document.getElementById('root');
if (applicationMountElement === null) {
  throw new Error('index.html must contain an element with id="root" to mount the app into.');
}

createRoot(applicationMountElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
