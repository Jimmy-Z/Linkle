import { a2purge, a2remove, a2tellAll, qbt_delete, qbt_info } from "./rpc.js";

chrome.storage.sync.get(null, init);

async function init(sync: unknown) {
	const { profiles } = sync as {
		profiles?: string[];
	};
	const { intercept } = (await chrome.storage.local.get("intercept")) as {
		intercept?: string;
	};

	if (profiles !== undefined) {
		// profile list
		const profiles_menu_items = [];
		for (const name of profiles) {
			let li;
			if (name === intercept) {
				li = txt("li", `\u21c0 ${name}`);
				li.className = "profile selected";
			} else {
				li = txt("li", name);
				li.className = "profile";
				li.addEventListener("click", async () => {
					await chrome.storage.local.set({ intercept: name });
					window.close();
				});
			}
			profiles_menu_items.push(li);
		}

		// off button
		if (intercept !== undefined && profiles.includes(intercept)) {
			const off = txt("li", "off");
			off.id = "off";
			off.addEventListener("click", async () => {
				await chrome.storage.local.remove("intercept");
				window.close();
			});
			profiles_menu_items.push(off);
		}
		(by_id("profiles") as HTMLElement).replaceChildren(
			...profiles_menu_items,
		);

		// download tasks
		// dedupe profiles into url - token/key
		const a2: { [_: string]: string | undefined } = {};
		const qbt: { [_: string]: string | undefined } = {};
		for (const name of profiles) {
			const k = `p.${name}`;
			const conf = (sync as { [_: string]: string[] })[k];
			if (conf === undefined) {
				console.warn(`error getting profile ${name}`);
				continue;
			}
			// this is a lite version of parse_profile in linkle.ts
			const kv: { [_: string]: string } = {};
			for (const l of conf) {
				if (l.length === 0 || l[0] === ";") {
					continue;
				}
				const sep = l.indexOf("=");
				if (sep === -1) {
					continue;
				}
				const k = l.slice(0, sep).trim();
				const v = l.slice(sep + 1).trim();
				kv[k] = v;
			}
			if (kv.type === "aria2" && kv.url !== undefined) {
				a2[kv.url] = kv.token;
			} else if (kv.type === "qbt" && kv.url !== undefined) {
				qbt[kv.url] = kv.key;
			} else {
				console.warn("invalid profile:", kv);
			}
		}

		const tasks_menu = by_id("tasks") as HTMLElement;
		// a2
		for (const url in a2) {
			const token = a2[url];
			const [cap, sub] = tasks_head(tasks_menu, "a2");

			await populate_a2_tasks(cap, sub, url, token);
			// setInterval(async () => {
			// 	await populate_a2_tasks(cap, sub, url, token);
			// }, 1000);
		}
		// qbt
		for (const url in qbt) {
			const key = qbt[url];
			const [cap, sub] = tasks_head(tasks_menu, "qbt");

			await populate_qbt_tasks(cap, sub, url, key);
			// setInterval(async () => {
			// 	await populate_qbt_tasks(cap, sub, url, key);
			// }, 1000);
		}
	}

	(by_id("conf") as HTMLElement).addEventListener("click", async () => {
		chrome.runtime.openOptionsPage();
		window.close();
	});
}

function tasks_head(
	main: HTMLElement,
	cls: string,
): [HTMLElement, HTMLElement] {
	const li = create("li");
	li.className = cls;
	const cap = txt("div", "");
	const sub = create("ul");
	sub.className = "dl-list";
	li.append(cap, sub);
	main.appendChild(li);
	return [cap, sub];
}

async function populate_a2_tasks(
	caption: HTMLElement,
	list: HTMLElement,
	url: string,
	token?: string,
	timeout?: number,
) {
	const items = await a2tellAll(url, token, timeout);
	if (items === undefined) {
		update_txt(caption, `aria2 ${host(url)} - access denied`);
		return;
	}
	let remaining = 0;
	let purge_ctr = 0;
	list.replaceChildren(
		...items.map((t) => {
			console.debug("aria2:", t);
			let size;
			const complete = parseInt(t.completedLength);
			const total = parseInt(t.totalLength);
			if (complete === total) {
				size = `${pretty_size(complete)}`;
			} else {
				size = `${pretty_size(complete)} / ${pretty_size(total)}`;
			}
			if (
				["active", "waiting", "paused"].includes(t.status) &&
				complete < total
			) {
				remaining += 1;
			}
			if (["complete", "error", "removed"].includes(t.status)) {
				purge_ctr += 1;
			}
			const speed = parseInt(t.downloadSpeed);
			const del = txt("span", "\u00d7");
			del.className = "del";
			del.addEventListener("click", async () => {
				await a2remove(url, token, t.gid);
				window.close();
			});
			const item = container(
				"li",
				del,
				name_div(a2name(t.dir, t.files[0].path, t.gid)),
				progress(complete / total),
				txt("span", `${t.status}`),
				txt(
					"span",
					total === 0
						? "N/A"
						: pretty_remainder((complete / total) * 100, 4) + "%",
				),
				txt("span", size),
				txt("span", `${pretty_size(speed)}B/s`),
				txt("span", `${pretty_duration((total - complete) / speed)}`),
			);
			item.className = "dl-item";
			return item;
		}),
	);
	update_txt(caption, `aria2 ${host(url)} - ${remaining}`);
	if (purge_ctr > 0) {
		const purge = txt("span", "purge");
		purge.className = "purge";
		purge.title = `purge ${purge_ctr} tasks`;
		purge.addEventListener("click", async () => {
			await a2purge(url, token);
			window.close();
		});
		caption.appendChild(purge);
	}
}

// aria2 status doesn't have a simple name field
function a2name(dir: string, file: string, gid: string): string {
	if (file === "") {
		return gid;
	}
	if (!file.startsWith(dir)) {
		return file;
	}
	file = file.slice(dir.length);
	if (file[0] === "/") {
		file = file.slice(1);
	}
	const sep = file.indexOf("/");
	if (sep !== -1) {
		file = file.slice(0, sep);
	}
	return file;
}

async function populate_qbt_tasks(
	caption: HTMLElement,
	list: HTMLElement,
	url: string,
	key?: string,
	timeout?: number,
) {
	const items = await qbt_info(url, key, timeout);
	if (items === undefined) {
		update_txt(caption, `qBittorrent ${host(url)} - access denied`);
		return;
	}
	let remaining = 0;
	list.replaceChildren(
		...items.map((t) => {
			console.debug("qbt:", t);
			let size;
			if (t.completed === t.size) {
				size = `${pretty_size(t.completed)}`;
			} else {
				size = `${pretty_size(t.completed)} / ${pretty_size(t.size)}`;
			}
			if (t.progress < 1) {
				remaining += 1;
			}
			const del = txt("span", "\u00d7");
			del.className = "del";
			del.title = `remove torrent${t.progress < 1 ? " and files" : ""}`;
			del.addEventListener("click", async () => {
				// remove files if it's incomplete
				await qbt_delete(url, t.hash, t.progress < 1, key);
				window.close();
			});
			const item = container(
				"li",
				del,
				name_div(t.name),
				progress(t.progress),
				txt("span", `${t.state}`),
				txt("span", pretty_remainder(t.progress * 100, 4) + "%"),
				txt("span", size),
				txt("span", `${pretty_size(t.dlspeed)}B/s`),
				txt("span", `${pretty_duration(t.eta)}`),
			);
			item.className = "dl-item";
			return item;
		}),
	);
	update_txt(caption, `qBittorrent ${host(url)} - ${remaining}`);
}

function host(url: string): string {
	const u = new URL(url);
	return u.host;
}

const PREFIXES = ["", "K", "M", "G", "T"];
function pretty_size(n: number): string {
	let unit;
	for (unit = 0; unit < PREFIXES.length; ++unit) {
		if (n < 1024) {
			break;
		} else {
			n /= 1024;
		}
	}
	return `${pretty_remainder(n, 4)} ${PREFIXES[unit]}`;
}

const DURATION_PREFIXES: [number, string][] = [
	[60, "seconds"],
	[60, "minutes"],
	[Number.POSITIVE_INFINITY, "hours"],
];
function pretty_duration(d: number): string {
	// console.debug("pretty_duration:", d);
	if (Number.isNaN(d) || d >= 86400) {
		return "N/A";
	}
	let unit;
	for (unit = 0; unit < DURATION_PREFIXES.length; ++unit) {
		if (d < DURATION_PREFIXES[unit][0]) {
			break;
		} else {
			d /= DURATION_PREFIXES[unit][0];
		}
	}
	return `${pretty_remainder(d, 3)} ${DURATION_PREFIXES[unit][1]}`;
}

function pretty_remainder(n: number, length: number): string {
	let remainder = n.toString().slice(0, length);
	if (remainder.endsWith(".")) {
		remainder = remainder.slice(0, -1);
	}
	return remainder;
}

function name_div(name: string): HTMLElement {
	const e = txt("div", name);
	e.title = name;
	return e;
}

function container(tag: string, ...nodes: Node[]): HTMLElement {
	const e = create(tag);
	e.append(...nodes);
	return e;
}

function txt(tag: string, txt: string): HTMLElement {
	const t = create(tag);
	t.appendChild(document.createTextNode(txt));
	return t;
}

function update_txt(e: HTMLElement, txt: string) {
	e.replaceChildren(document.createTextNode(txt));
}

function progress(p: number): HTMLDivElement {
	// styling a real progress bar seems like a nightmare
	const bar = create("div");
	bar.className = "progress";
	const fill = create("div");
	fill.className = "fill";
	fill.style = `width: ${p * 100}%;`;
	bar.appendChild(fill);
	return bar as HTMLDivElement;
}

function create(tag: string): HTMLElement {
	return document.createElement(tag);
}

function by_id(id: string): HTMLElement | null {
	return document.getElementById(id);
}
