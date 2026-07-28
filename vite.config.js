import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/lineavip': {
				target: 'https://sista.com.ar',
				changeOrigin: true,
				secure: true
			},
			'/internacional': {
				target: 'https://sista.com.ar',
				changeOrigin: true,
				secure: true
			}
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
