import { log_chrome_error } from "./common.js";

export async function get_cookies(
	mode: string | undefined,
	info: chrome.contextMenus.OnClickData,
): Promise<string | undefined> {
	// to do
	if (mode === undefined) {
		return await get_page_cookie(info);
	} else {
		console.warn(`cookie mode "${mode}" not supported yet`);
	}
	return undefined;
}

async function get_page_cookie(
	info: chrome.contextMenus.OnClickData,
): Promise<string | undefined> {
	// we are doing this for link context menu, assume they exist
	const url_link = new URL(info.linkUrl as string);
	const url_page = new URL(info.pageUrl as string);
	const url_frame =
		info.frameUrl === undefined ? undefined : new URL(info.frameUrl);
	if (!is_http(url_page) || !is_http(url_link)) {
		console.debug("get_page_cookie: link or page isn't http(s)");
		return undefined;
	}
	let get_frame = false;
	if (url_page.host !== url_link.host) {
		console.debug(
			"get_page_cookie: link and page doesn't have matching host",
		);
		if (url_frame !== undefined && url_frame.host === url_page.host) {
			console.debug("get_page_cookie: but the frame does");
			get_frame = true;
		} else {
			return undefined;
		}
	}
	const current_tab = await get_current_tab(url_page.host);
	if (current_tab === undefined) {
		return undefined;
	}
	const res = await chrome.scripting.executeScript({
		target: {
			tabId: current_tab,
			frameIds: get_frame === true ? [info.frameId as number] : undefined,
		},
		func: () => {
			return document.cookie;
		},
	});
	console.debug("chrome.scripting.executeScript():", res);
	log_chrome_error("chrome.tabs.executeScript failed:");
	if (res === undefined) {
		return undefined;
	}
	return res[0].result;
}

// it's really funny chrome.contextMenus.OnClickData doesn't have a tabId
async function get_current_tab(
	host_verify: string,
): Promise<number | undefined> {
	const queryOptions = { active: true, lastFocusedWindow: true };
	// `tab` will either be a `tabs.Tab` instance or `undefined`.
	const [tab] = await chrome.tabs.query(queryOptions);
	console.assert(tab !== undefined);
	console.assert(tab.url !== undefined);
	if (new URL(tab.url as string).host !== host_verify) {
		console.warn(
			"unexpected current tab url doesn't match",
			host_verify,
			tab.url,
		);
		return undefined;
	}
	// console.debug(`get current tab: ${tab.id} ${tab.url}`);
	return tab.id;
}

function is_http(url: URL): boolean {
	return url.protocol === "https:" || url.protocol === "http:";
}
