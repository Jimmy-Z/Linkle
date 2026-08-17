// fetch with timeout and error notification
async function fetch_ex(
	url: string,
	opts: RequestInit,
	timeout: number|undefined, // in milliseconds
): Promise<Response | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeout === undefined || isNaN(timeout) ? 2501 : timeout);
	opts.signal = ctrl.signal;

	let resp = null;
	try {
		resp = await fetch(url, opts);
	} catch (err) {
		// to do: notification
		console.error(`fetch ${url} error:`, err);
		return null;
	}
	clearTimeout(timer);
	if (resp.status < 200 || resp.status >= 300) {
		console.error(`fetch ${url}: ${resp.status} ${resp.statusText}`);
		return null;
	}
	return resp;
}

type Method = "GET" | "POST";

async function a2(
	url: string,
	token: string,
	method: string,
	args: any[],
	timeout: number|undefined,
): Promise<any> {
	// json-rpc
	const id = Math.random().toString();
	const post = JSON.stringify({
		jsonrpc: "2.0",
		id: id,
		method: `aria2.${method}`,
		params: (token != "" ? ["token:" + token] : []).concat(args),
	});
	const resp = await fetch_ex(
		url,
		{
			method: "POST",
			body: post,
		},
		timeout,
	);
	if (resp === null) {
		return null;
	}
	const json = await resp.json();
	console.assert(json.id == id);
	const err = json.error;
	if (err !== undefined) {
		console.error(`json-rpc error ${err.code}: ${err.message}`);
		return null;
	}
	return json.result;
}

export async function a2addUri(
	a2url: string,
	token: string,
	uris: string[],
	opts: { [key: string] :string| string[]},
	timeout: number|undefined,
): Promise<string> {
	const resp = await a2(a2url, token, "addUri", [uris, opts], timeout);
	if (typeof resp !== "string") {
		console.error(`expecting string, got:`, resp);
		return "";
	}
	return resp;
}
