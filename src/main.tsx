/**
 * FILE HEADER: Application Entry Point
 * 
 * This is the very first file that runs when the application starts.
 * It "boots up" React and tells it to display our main "App" component
 * inside the "root" element of our web page.
 * 
 * For non-coders: Think of this as the "On" switch for the entire application.
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// This line finds the "root" spot in our HTML file and starts the React engine there.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

