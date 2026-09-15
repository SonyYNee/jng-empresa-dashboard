import { defineConfig } from 'vite';
const proxy = Object.fromEntries(
  [
    '/api/public/fleet',
    '/api/public/routes',
    '/api/public/social',
    '/api/public/trips',
    '/api/public/events',
    '/media',
  ].map((path) => [path, { target: 'http://127.0.0.1:3000', changeOrigin: true }]),
);
export default defineConfig({ server: { proxy }, preview: { proxy } });
