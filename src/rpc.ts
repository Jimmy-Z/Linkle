// fetch with timeout and error notification
async function fetch_ex(
	url: string,
	opts: RequestInit,
	timeout?: number, // in milliseconds
): Promise<Response | undefined> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeout === undefined || isNaN(timeout) ? 2501 : timeout);
	opts.signal = ctrl.signal;

	let resp;
	try {
		resp = await fetch(url, opts);
	} catch (err) {
		// to do: notification
		console.error(`fetch ${url} error:`, err);
		return undefined;
	}
	clearTimeout(timer);
	if (resp.status < 200 || resp.status >= 300) {
		console.error(`fetch ${url}: ${resp.status} ${resp.statusText}`);
		return undefined;
	}
	return resp;
}

// https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface
interface A2Opts {
	[key: string]: string | string[];
}

async function a2(
	url: string,
	token: string | undefined,
	method: string,
	args: [string[], A2Opts],
	timeout?: number,
): Promise<object | undefined> {
	// json-rpc
	const id = Math.random().toString();
	const post = JSON.stringify({
		jsonrpc: "2.0",
		id: id,
		method: `aria2.${method}`,
		params: token !== undefined ? ["token:" + token, ...args] : args,
	});
	const resp = await fetch_ex(
		url,
		{
			method: "POST",
			body: post,
			credentials: "omit",
		},
		timeout,
	);
	if (resp === undefined) {
		return undefined;
	}
	const json = await resp.json();
	console.assert(json.id === id);
	const err = json.error;
	if (err !== undefined) {
		console.error(`json-rpc error ${err.code}: ${err.message}`);
		return undefined;
	}
	return json.result;
}

export async function a2addUri(
	url: string,
	token: string | undefined,
	uris: string[],
	opts: A2Opts,
	timeout?: number,
): Promise<string> {
	const resp = await a2(url, token, "addUri", [uris, opts], timeout);
	if (typeof resp !== "string") {
		console.error(`expecting string, got:`, resp);
		return "";
	}
	return resp;
}

// https://github.com/qbittorrent/qBittorrent/wiki/API-Key-Authentication-(%E2%89%A5v5.2.0)
// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)#add-new-torrent
// /api/v2/torrents/add
async function qbt(
	url: string,
	method: string,
	args: [string, string][],
	multipart: boolean,
	key?: string,
	timeout?: number,
): Promise<Response | undefined> {
	const opts: RequestInit = {
		method: "POST",
		credentials: "omit",
	};
	if (multipart) {
		const form = new FormData();
		for (const arg of args) {
			form.append(...arg);
		}
		opts.body = form;
	} else {
		opts.body = new URLSearchParams(args);
	}
	if (key) {
		const headers = new Headers();
		headers.append("Authorization", `Bearer ${key}`);
		opts.headers = headers;
	}
	return await fetch_ex(`${url}/api/v2${method}`, opts, timeout);
}

export async function qbt_add(
	url: string,
	link: string,
	opts: [string, string][],
	key?: string,
	timeout?: number,
): Promise<boolean | undefined> {
	opts.push(["urls", link]);
	const resp = await qbt(url, "/torrents/add", opts, true, key, timeout);
	if (resp === undefined) {
		return undefined;
	}
	console.debug("qbt add:", resp?.text());
	return resp.ok;
}
