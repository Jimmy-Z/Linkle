// fetch with timeout and error notification
async function fetch_ex(
	url: string,
	init: RequestInit,
	timeout?: number, // in milliseconds
): Promise<Response | undefined> {
	const ctrl = new AbortController();
	const timer = setTimeout(
		() => ctrl.abort(),
		timeout === undefined || isNaN(timeout) ? 2501 : timeout,
	);
	init.signal = ctrl.signal;

	let resp;
	try {
		resp = await fetch(url, init);
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
async function a2(
	url: string,
	token: string | undefined,
	method: string,
	args: unknown[],
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

interface A2Opts {
	[key: string]: string | string[];
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
		console.error("expecting string, got:", resp);
		return "";
	}
	return resp;
}

interface A2Status {
	gid: string;
	status: string;
	totalLength: string;
	completedLength: string;
	downloadSpeed: string;
	dir: string;
	files: {
		path: string;
	}[];
}
const A2_STATUS_KEYS = [
	"gid",
	"status",
	"totalLength",
	"completedLength",
	"downloadSpeed",
	"dir",
	"files",
];

export async function a2tellAll(
	url: string,
	token: string | undefined,
	timeout?: number,
): Promise<A2Status[]> {
	const active = await a2(url, token, "tellActive", [A2_STATUS_KEYS], timeout);
	const waiting = await a2(
		url,
		token,
		"tellWaiting",
		[0, 16, A2_STATUS_KEYS],
		timeout,
	);
	const stopped = await a2(
		url,
		token,
		"tellStopped",
		[0, 16, A2_STATUS_KEYS],
		timeout,
	);
	const ret = [];
	for (const resp of [active, waiting, stopped]) {
		if (typeof active !== "object") {
			console.error("expecting array, got:", active);
		} else {
			ret.push(...(resp as A2Status[]));
		}
	}
	return ret;
}

export async function a2remove(
	url: string,
	token: string | undefined,
	gid: string,
	timeout?: number,
): Promise<string> {
	const resp = await a2(url, token, "remove", [gid], timeout);
	if (typeof resp !== "string") {
		console.error("expecting string, got:", resp);
		return "";
	}
	return resp;
}

export async function a2purge(
	url: string,
	token: string | undefined,
	timeout?: number,
): Promise<boolean> {
	const resp = await a2(url, token, "purgeDownloadResult", [], timeout);
	if (typeof resp !== "string") {
		console.error("expecting string, got:", resp);
		return false;
	}
	return resp === "OK";
}

enum HttpMethod {
	Get,
	Post,
	PostMultiPart,
}

// https://github.com/qbittorrent/qBittorrent/wiki/API-Key-Authentication-(%E2%89%A5v5.2.0)
async function qbt(
	api_url: string,
	http_method: HttpMethod,
	api_method: string,
	args: [string, string][],
	key?: string,
	timeout?: number,
): Promise<Response | undefined> {
	const init: RequestInit = {
		method: http_method === HttpMethod.Get ? "GET" : "POST",
		credentials: "omit",
		cache: "no-store"
	};

	let url = `${api_url}/api/v2${api_method}`;

	switch (http_method) {
		case HttpMethod.Get:
			url += "?" + new URLSearchParams(args).toString();
			break;
		case HttpMethod.Post:
			init.body = new URLSearchParams(args);
			break;
		case HttpMethod.PostMultiPart:
			{
				const form = new FormData();
				for (const arg of args) {
					form.append(...arg);
				}
				init.body = form;
			}
			break;
	}

	if (key) {
		const headers = new Headers();
		headers.append("Authorization", `Bearer ${key}`);
		init.headers = headers;
	}
	return await fetch_ex(url, init, timeout);
}

// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)#add-new-torrent
// /api/v2/torrents/add
export async function qbt_add(
	url: string,
	link: string,
	args: [string, string][],
	key?: string,
	timeout?: number,
): Promise<boolean | undefined> {
	args.push(["urls", link]);
	const resp = await qbt(
		url,
		HttpMethod.PostMultiPart,
		"/torrents/add",
		args,
		key,
		timeout,
	);
	console.debug("qbt add:", resp?.text());
	if (resp === undefined) {
		return undefined;
	}
	return resp.ok;
}

// /api/v2/torrents/info
export interface QbtInfo {
	hash: string;
	name: string;
	state: string;
	size: number;
	completed: number;
	progress: number;
	dlspeed: number;
	eta: number;
}

export async function qbt_info(
	url: string,
	key?: string,
	timeout?: number,
): Promise<QbtInfo[] | undefined> {
	const resp = await qbt(
		url,
		HttpMethod.Get,
		"/torrents/info",
		[
			["sort", "added_on"],
			["reverse", "true"],
		],
		key,
		timeout,
	);
	if (resp === undefined || !resp.ok) {
		return undefined;
	}
	return (await resp.json()) as QbtInfo[];
}

export async function qbt_delete(
	url: string,
	hashes: string,
	delete_files: boolean,
	key?: string,
	timeout?: number,
): Promise<boolean | undefined> {
	const resp = await qbt(
		url,
		HttpMethod.Post,
		"/torrents/delete",
		[
			["hashes", hashes],
			["deleteFiles", delete_files.toString()],
		],
		key,
		timeout,
	);
	if (resp === undefined) {
		return undefined;
	}
	return resp.ok;
}
