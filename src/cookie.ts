import { last_err } from "./common.js";

export async function get_cookies(link: string): Promise<string | undefined> {
	if (!is_http(link)) {
		return undefined;
	}
	let cookies;
	try {
		cookies = await chrome.cookies.getAll({ url: link });
	} catch (e) {
		last_err(`cookie.getAll("${link}"):`);
		console.warn("failed to retrieve cookie:", e);
		return undefined;
	}
	return cookies
		.map(
			(c) => encodeURIComponent(c.name) + "=" + encodeURIComponent(c.value),
		)
		.join("; ")
}

function is_http(link: string): boolean {
	const url = new URL(link);
	return url.protocol === "https:" || url.protocol === "http:";
}
