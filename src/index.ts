const PROTONMAIL_API_BASE = 'https://api.protonmail.ch';

interface Env {
	DOMAINS: string;
}

function findRootDomain(hostname: string, domains: string[]): string | undefined {
	return domains.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

async function handleOpenPGPRequest(request: Request, url: URL, rootDomain: string): Promise<Response> {
	let pathSegments = url.pathname.split('/').filter(Boolean);

	if (url.hostname.startsWith('openpgpkey.')) {
		const last = pathSegments.at(-1);
		pathSegments = last !== undefined ? [last] : [];
	} else {
		pathSegments = pathSegments.slice(pathSegments.indexOf('openpgpkey') + 1);
	}

	const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
	const localPart = url.searchParams.get('l');

	let upstreamUrl: string;

	if (lastSegment === 'policy') {
		upstreamUrl = `${PROTONMAIL_API_BASE}/.well-known/openpgpkey/${rootDomain}/policy`;
	} else {
		if (!localPart) {
			console.log({ level: 'warn', event: 'missing_local_part', domain: rootDomain, path: url.pathname });
			return new Response("Missing local part in query parameter 'l'", { status: 400 });
		}
		const upstream = new URL(`${PROTONMAIL_API_BASE}/.well-known/openpgpkey/${rootDomain}/hu/${lastSegment}`);
		upstream.searchParams.set('l', localPart);
		upstreamUrl = upstream.toString();
	}

	console.log({ level: 'info', event: 'upstream_fetch', url: upstreamUrl, method: request.method });

	const fetchInit: RequestInit = {
		method: request.method,
		headers: request.headers,
	};

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		fetchInit.body = request.body;
	}

	const response = await fetch(upstreamUrl, fetchInit);

	if (!response.ok) {
		const text = await response.text();
		console.log({
			level: 'warn',
			event: 'upstream_error',
			status: response.status,
			body: text,
			url: upstreamUrl,
		});
		return new Response('Upstream error', { status: response.status });
	}

	return response;
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		try {
			const domains = env.DOMAINS.split(',')
				.map((d) => d.trim())
				.filter(Boolean);
			const defaultDomain = domains[0];

			if (!defaultDomain) {
				console.log({ level: 'error', event: 'missing_domains', message: 'DOMAINS environment variable is empty or missing' });
				return new Response('Server configuration error', { status: 500 });
			}

			const hostname = url.hostname === 'localhost' ? defaultDomain : url.hostname;
			const rootDomain = findRootDomain(hostname, domains);

			if (!rootDomain) {
				console.log({ level: 'info', event: 'unsupported_domain', hostname });
				return new Response('Domain not supported', { status: 404 });
			}

			if (hostname.startsWith('openpgpkey.') || url.pathname.startsWith('/.well-known/openpgpkey/')) {
				return await handleOpenPGPRequest(request, url, rootDomain);
			}

			return await fetch(request);
		} catch (error) {
			console.log({
				level: 'error',
				event: 'unhandled_error',
				message: String(error),
			});
			return new Response('Internal Server Error', { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
