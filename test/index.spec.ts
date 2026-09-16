import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

function workerEnv(domains?: string): { DOMAINS: string } {
	if (domains !== undefined) {
		return { DOMAINS: domains };
	}
	if (!('DOMAINS' in env) || typeof env.DOMAINS !== 'string') {
		throw new Error('DOMAINS binding missing');
	}
	return { DOMAINS: env.DOMAINS };
}

afterEach(() => {
	vi.restoreAllMocks();
});

function mockFetch(handler: (request: Request) => Response | Promise<Response>): void {
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const request = new Request(input, init);
		return handler(request);
	});
}

function pathAndQuery(url: URL): string {
	return `${url.pathname}${url.search}`;
}

function mockProtonMail(pathPattern: RegExp | string, body: string, status = 200, method?: string): void {
	mockFetch((request) => {
		const url = new URL(request.url);
		const requestPath = pathAndQuery(url);
		const pathMatches = typeof pathPattern === 'string' ? requestPath === pathPattern : pathPattern.test(requestPath);
		if (url.origin === 'https://api.protonmail.ch' && pathMatches && (method === undefined || request.method === method)) {
			return new Response(body, { status });
		}
		throw new Error(`No mock found for ${request.method} ${request.url}`);
	});
}

describe('domain validation', () => {
	it('returns 404 for unsupported domain', async () => {
		const request = new Request('https://unknown.example/.well-known/openpgpkey/hu/abc123?l=test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Domain not supported');
	});

	it('maps localhost to first configured domain', async () => {
		mockProtonMail(/\/\.well-known\/openpgpkey\/example\.com\/hu\/abc123/, 'key-data');

		const request = new Request('http://localhost/.well-known/openpgpkey/hu/abc123?l=test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});

	it.each(['example.com', 'example.org', 'example.net'])('accepts supported domain: %s', async (domain) => {
		mockProtonMail(new RegExp(`/\\.well-known/openpgpkey/${domain.replace('.', '\\.')}/hu/abc123`), 'key-data');

		const request = new Request(`https://openpgpkey.${domain}/hu/abc123?l=user`);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});
});

describe('DOMAINS configuration', () => {
	it('returns 500 when DOMAINS is empty', async () => {
		const request = new Request('https://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(''), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Server configuration error');
	});
});

describe('HU key requests', () => {
	it('proxies openpgpkey subdomain request to ProtonMail', async () => {
		mockProtonMail('/.well-known/openpgpkey/example.com/hu/abc123hash?l=user%40example.com', 'pgp-key-binary');

		const request = new Request('https://openpgpkey.example.com/hu/abc123hash?l=user@example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('pgp-key-binary');
	});

	it('proxies .well-known path request to ProtonMail', async () => {
		mockProtonMail('/.well-known/openpgpkey/example.org/hu/def456hash?l=admin%40example.org', 'pgp-key-data');

		const request = new Request('https://example.org/.well-known/openpgpkey/hu/def456hash?l=admin@example.org');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('pgp-key-data');
	});

	it('passes body on POST requests', async () => {
		mockProtonMail(/\/\.well-known\/openpgpkey\/example\.com\/hu\/abc123/, 'ok', 200, 'POST');

		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=user', {
			method: 'POST',
			body: 'request-body',
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});
});

describe('policy requests', () => {
	it('handles policy request on openpgpkey subdomain without ?l= parameter', async () => {
		mockProtonMail('/.well-known/openpgpkey/example.com/policy', '');

		const request = new Request('https://openpgpkey.example.com/policy');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});

	it('handles policy request on .well-known path without ?l= parameter', async () => {
		mockProtonMail('/.well-known/openpgpkey/example.net/policy', '');

		const request = new Request('https://example.net/.well-known/openpgpkey/policy?l=ignored');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});
});

describe('error handling', () => {
	it('returns 400 for openpgpkey subdomain with empty path', async () => {
		const request = new Request('https://openpgpkey.example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
	});

	it('returns 400 when ?l= is missing on HU request', async () => {
		const request = new Request('https://openpgpkey.example.com/hu/abc123');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Missing local part in query parameter 'l'");
	});

	it('returns 400 when ?l= is empty on HU request', async () => {
		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
	});

	it('passes through upstream error status', async () => {
		mockProtonMail(/\/\.well-known\/openpgpkey/, 'Not Found', 404);

		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=user');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Upstream error');
	});

	it('returns 500 on network error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

		const request = new Request('https://openpgpkey.example.com/hu/abc123?l=user');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Internal Server Error');
	});
});

describe('non-openpgp passthrough', () => {
	it('passes through non-OpenPGP requests', async () => {
		mockFetch((request) => {
			const url = new URL(request.url);
			if (url.origin === 'https://example.com' && url.pathname === '/some-page') {
				return new Response('page content', { status: 200 });
			}
			throw new Error(`No mock found for ${request.method} ${request.url}`);
		});

		const request = new Request('https://example.com/some-page');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, workerEnv(), ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('page content');
	});
});
