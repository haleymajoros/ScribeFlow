/**
 * FILE HEADER: Build Tool Configuration (Vite)
 * 
 * This file tells the "Vite" build tool how to bundle our application,
 * what plugins to use (like React and Tailwind), and how to handle
 * environment variables (like our AI API key).
 * 
 * For non-coders: This is the "blueprint" for how the application is
 * packaged and delivered to your web browser.
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Load environment variables (like the GEMINI_API_KEY)
  const env = loadEnv(mode, '.', '');
  
  return {
    // Plugins are extra tools that help Vite understand React and Tailwind
    plugins: [react(), tailwindcss()],
    
    // This makes the AI API key available to our code
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    // This helps the code find files using shortcuts like "@"
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    
    // Server settings for development
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
