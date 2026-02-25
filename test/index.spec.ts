import { env, createExecutionContext, waitOnExecutionContext, fetchMock } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DOMAINS: string;
	}
}

beforeEach(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => {
	fetchMock.deactivate();
});

describe('domain validation', () => {
	it('returns 404 for unsupported domain', async () => {
		const request = new Request('https://unknown.example/.well-known/openpgpkey/hu/abc123?l=test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Domain not supported');
	});

	it('maps localhost to first configured domain', async () => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({ path: /\/\.well-known\/openpgpkey\/example\.com\/hu\/abc123/ })
			.reply(200, 'key-data');

		const request = new Request('http://localhost/.well-known/openpgpkey/hu/abc123?l=test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});

	it.each(['example.com', 'example.org', 'example.net'])('accepts supported domain: %s', async (domain) => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({ path: new RegExp(`/\\.well-known/openpgpkey/${domain.replace('.', '\\.')}/hu/abc123`) })
			.reply(200, 'key-data');

		const request = new Request(`https://openpgpkey.${domain}/hu/abc123?l=user`);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});
});

describe('DOMAINS configuration', () => {
	it('returns 500 when DOMAINS is empty', async () => {
		const request = new Request('https://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, { ...env, DOMAINS: '' }, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Server configuration error');
	});
});

describe('HU key requests', () => {
	it('proxies openpgpkey subdomain request to ProtonMail', async () => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({
				path: '/.well-known/openpgpkey/example.com/hu/abc123hash?l=user%40example.com',
			})
			.reply(200, 'pgp-key-binary');

		const request = new Request('https://openpgpkey.example.com/hu/abc123hash?l=user@example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('pgp-key-binary');
	});

	it('proxies .well-known path request to ProtonMail', async () => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({
				path: '/.well-known/openpgpkey/example.org/hu/def456hash?l=admin%40example.org',
			})
			.reply(200, 'pgp-key-data');

		const request = new Request('https://example.org/.well-known/openpgpkey/hu/def456hash?l=admin@example.org');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('pgp-key-data');
	});

	it('passes body on POST requests', async () => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({
				method: 'POST',
				path: /\/\.well-known\/openpgpkey\/example\.com\/hu\/abc123/,
			})
			.reply(200, 'ok');

		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=user', {
			method: 'POST',
			body: 'request-body',
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});
});

describe('policy requests', () => {
	it('handles policy request on openpgpkey subdomain without ?l= parameter', async () => {
		fetchMock.get('https://api.protonmail.ch').intercept({ path: '/.well-known/openpgpkey/example.com/policy' }).reply(200, '');

		const request = new Request('https://openpgpkey.example.com/policy');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});

	it('handles policy request on .well-known path without ?l= parameter', async () => {
		fetchMock.get('https://api.protonmail.ch').intercept({ path: '/.well-known/openpgpkey/example.net/policy' }).reply(200, '');

		const request = new Request('https://example.net/.well-known/openpgpkey/policy?l=ignored');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});
});

describe('error handling', () => {
	it('returns 400 for openpgpkey subdomain with empty path', async () => {
		const request = new Request('https://openpgpkey.example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
	});

	it('returns 400 when ?l= is missing on HU request', async () => {
		const request = new Request('https://openpgpkey.example.com/hu/abc123');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Missing local part in query parameter 'l'");
	});

	it('returns 400 when ?l= is empty on HU request', async () => {
		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
	});

	it('passes through upstream error status', async () => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({ path: /\/\.well-known\/openpgpkey/ })
			.reply(404, 'Not Found');

		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=user');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Upstream error');
	});

	it('returns 500 on network error', async () => {
		fetchMock
			.get('https://api.protonmail.ch')
			.intercept({ path: /\/\.well-known\/openpgpkey/ })
			.replyWithError(new Error('Network failure'));

		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=user');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Internal Server Error');
	});
});

describe('non-openpgp passthrough', () => {
	it('passes through non-OpenPGP requests', async () => {
		fetchMock.get('https://example.com').intercept({ path: '/some-page' }).reply(200, 'page content');

		const request = new Request('https://example.com/some-page');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('page content');
	});
});
