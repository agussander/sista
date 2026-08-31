import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		// Los tests de fechas de la Cartera afirman resultados concretos ("el
		// 1/7 a las 01:00 UTC se muestra como 30/6 22:00"). Sin fijar la zona,
		// pasan en las maquinas del equipo y fallan en cualquier CI que corra
		// en UTC.
		env: { TZ: 'America/Argentina/Buenos_Aires' }
	}
});
