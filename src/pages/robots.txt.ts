import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const base = site ?? new URL('https://example.github.io');
	return new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap-index.xml', base)}\n`);
};
