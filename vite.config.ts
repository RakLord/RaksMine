import { defineConfig } from 'vite';

// Project GitHub Pages serve from https://<user>.github.io/RaksMine/, so built
// asset URLs must be prefixed with the repo name. Without this, they 404.
export default defineConfig({
  base: '/RaksMine/',
  server: {
    host: true,          // bind 0.0.0.0 so other devices on your LAN can reach the dev server
    allowedHosts: true,  // accept tunnelled hosts (ngrok). Testing convenience — disables Vite's
                         // host check (DNS-rebinding guard), so keep it to dev/testing only.
  },
});
