/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from '@module-federation/vite';

// Dois modos de build:
//  - padrão: app isolado (index.html + mock local) — usado no `npm run dev` e no deploy de demonstração
//  - "mfe":  módulo ES com os lifecycles do Single-SPA, para o import map do App Shell (Grupo 1)
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(),
           federation({
      name: 'smart40_g5',
      filename: 'remoteEntry.js',
      dts: false,
      exposes: {
        './Expedicao': './src/App.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    })
           ],
  server: {
    port: 8084,
    strictPort: true,
    cors: true, // o App Shell (porta 9000) precisa buscar o módulo nesta porta
  },
  preview: { port: 8084, cors: true },
  build:
    mode === "mfe"
      ? {
          outDir: "dist-mfe",
          lib: {
            entry: "src/smart40-expedicao-oee.tsx",
            formats: ["es"],
            fileName: () => "smart40-expedicao-oee.js",
          },
          rollupOptions: {
            // React é empacotado junto: cada grupo pode ter sua versão sem depender do Shell
            external: [],
          },
        }
      : { outDir: "dist" },
  define: mode === "mfe" ? { "process.env.NODE_ENV": JSON.stringify("production") } : {},
  test: {
    environment: "jsdom",
    globals: true,
  },
}));
