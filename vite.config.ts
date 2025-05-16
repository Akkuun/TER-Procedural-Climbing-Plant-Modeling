import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        extensions: ['.ts', '.js'], // Ensure Vite resolves `.ts` files
    },
    build: {
        rollupOptions: {
            input: './src/main.ts', // Set the entry point to `main.ts`
        },
    },
});