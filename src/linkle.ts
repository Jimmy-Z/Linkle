import { is_array_of_str, log_chrome_error, to_boolean } from "./common.js";
import { a2addUri } from "./rpc.js";
import { get_cookies } from "./cookie.js";

chrome.runtime.onInstalled.addListener(installed);
chrome.contextMenus.onClicked.addListener(clicked);
chrome.storage.onChanged.addListener(conf_changed);

interface Profile {
	name: string;
	type: string;
	[key: string]: string;
};

async function linkle(
	profile: Profile,
	info: chrome.contextMenus.OnClickData,
	n_id: string,
	n_items: chrome.notifications.NotificationItem[],
) {
	if (profile.type === "aria2") {
		const o: { [key: string]: string | string[] } = {};
		const page = info.pageUrl;
		const link = info.linkUrl as string;
		if (typeof page === "string") {
			const frag = page.indexOf("#");
			o.referer = frag === -1 ? page : page.slice(0, frag);
		}
		for (const k in profile) {
			if (is_aria2_opt(k)) {
				o[k] = profile[k];
			}
		}
		const cookie = await get_cookies(profile.cookie, info);
		if (typeof cookie === "string" && cookie.length > 0) {
			if (o.header === undefined) {
				o.header = ["Cookie: " + cookie];
			} else {
				(o.header as string[]).push("Cookie: " + cookie);
			}
		}
		if (to_boolean(profile.dry_run)) {
			console.debug("aria2 dry run:", link, o);
			return;
		}
		const gid = await a2addUri(
			profile.url,
			profile.token,
			[link],
			o,
			parseInt(profile.timeout),
		);
		if (gid !== undefined) {
			n_items.push({ title: "GID", message: gid });
			chrome.notifications.update(n_id, { items: n_items });
		}
	} else {
		console.error(`unknown profile type: "${profile.type}"`);
	}
}

async function clicked(info: chrome.contextMenus.OnClickData) {
	const profile_name = info.menuItemId as string;
	// https://developer.chrome.com/docs/extensions/reference/api/notifications#type-NotificationOptions
	// since notifications.update overwrites this item list, I'm passing it down
	const n_items: chrome.notifications.NotificationItem[] = [
		{
			title: "link",
			message: info.linkUrl as string,
		},
	];
	// note: items can't be empty
	const n_opts: chrome.notifications.NotificationCreateOptions = {
		type: "list",
		title: profile_name,
		message: "",
		iconUrl: "icon.png",
		items: n_items,
	};
	const n_id = await chrome.notifications.create(n_opts);

	const sync_name = `p.${profile_name}`;
	const r = await chrome.storage.sync.get(sync_name);
	const profile = parse_profile(profile_name, r[sync_name] as string[]);
	if (profile == null) {
		n_items.push({
			title: "",
			message: `error parsing profile "${profile_name}"`,
		});
		chrome.notifications.update(n_id, { items: n_items });
	} else {
		linkle(profile, info, n_id, n_items);
	}
}

function parse_profile(name: string, conf: string[]): Profile | null {
	if (conf === undefined || conf.length === 0) {
		return null;
	}
	const p: { [key: string]: string | string[] } = {};
	// split line and remove comments
	conf = conf.filter((l) => l.length && l[0] !== ";");
	conf.forEach((l) => {
		const sep = l.indexOf("=");
		if (sep === -1) {
			return;
		}
		const k = l.slice(0, sep).trim();
		const v = l.slice(sep + 1).trim();
		// multiple header and index-out lines are possible for aria2
		if (p["type"] === "aria2" && ["header", "index-out"].indexOf(k) !== -1) {
			const prev = p[k];
			if (prev === undefined) {
				p[k] = [v];
			} else {
				(prev as string[]).push(v);
			}
		} else {
			p[k] = v;
		}
	});
	if (typeof p["type"] !== "string") {
		return null;
	}
	return {
		name: name,
		type: p["type"],
		...p,
	};
}

function parse_synced(synced: { [key: string]: unknown }): Profile[] {
	if (!is_array_of_str(synced.profiles) || synced.profiles.length === 0) {
		return [];
	}
	const names = synced.profiles;
	const profiles: Profile[] = [];
	names.forEach((n) => {
		const p = parse_profile(n, synced[`p.${n}`] as string[]);
		if (p != null) {
			profiles.push(p);
		}
	});
	return profiles;
}

function make_context_menu_properties(
	profile: Profile,
): chrome.contextMenus.CreateProperties {
	return {
		id: profile.name,
		title: profile.name,
		contexts: ["link"],
		targetUrlPatterns: profile.link_patterns.split(" "),
	};
}

async function installed(details: chrome.runtime.InstalledDetails) {
	console.debug("installed:", details);
	const conf = await chrome.storage.sync.get(null);
	const profiles = parse_synced(conf);
	if (profiles.length === 0) {
		chrome.tabs.create({
			url: "chrome://extensions/?options=" + chrome.runtime.id,
		});
		return;
	}
	profiles.forEach((p) => {
		console.log(`creating context menu "${p.name}"`);
		// this api doesn't have a async variant
		chrome.contextMenus.create(make_context_menu_properties(p), () => {
			log_chrome_error(`error creating context menu "${p.name}":`);
		});
	});
}

function conf_changed(changes: {
	[key: string]: chrome.storage.StorageChange;
}) {
	console.debug("onChange:", changes);

	for (const k in changes) {
		if (!k.startsWith("p.")) {
			continue;
		}
		const name = k.slice(2);
		const v = changes[k];
		if (v.newValue !== undefined) {
			const p = make_context_menu_properties(
				parse_profile(name, v.newValue as string[]) as Profile,
			);
			if (v.oldValue === undefined) {
				console.log(`creating context menu "${name}"`);
				chrome.contextMenus.create(p, () =>
					log_chrome_error(`error creating context menu "${name}":`),
				);
			} else {
				delete p.id;
				console.log(`updating context menu "${name}"`);
				chrome.contextMenus.update(name, p, () =>
					log_chrome_error(`error updating context menu "${name}":`),
				);
			}
		} else {
			console.log(`removing context menu "${name}"`);
			chrome.contextMenus.remove(name, () =>
				log_chrome_error(`error removing context menu "${name}":`),
			);
		}
	}
}

const _NOT_ARIA2_OPT: { [key: string]: boolean } = {
	name: true,
	type: true,
	link_patterns: true,
	url: true,
	token: true,
	cookie: true,
	timeout: true,
	dry_run: true,
};

function is_aria2_opt(k: string): boolean {
	return !_NOT_ARIA2_OPT[k];
}
