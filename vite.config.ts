import { defineConfig } from 'vite';


export default defineConfig({
  // Specifies the project root directory
  root: './',
  // Explicitly defines the directory for static assets
  publicDir: 'public',
  // Include Angular-specific Vite plugins
  
  // Development server configuration
  server: {
    port: 4200,
    // Disable strict file system checks, which can sometimes help with unusual file types
    fs: {
      strict: false,
    },
  },
  // Build configuration
  build: {
    outDir: 'dist', // Output directory for the build
    // Prevents Vite from inlining large binary assets into the JavaScript bundle
    assetsInlineLimit: 0,
  },
  // Ensures these file types are recognized as assets during the build process
  assetsInclude: ['**/*.bin', '**/*.json', '**/*.shard1', '**/*.shard2', '**/*.weights'],
});