import { equal_array_of_str, is_array_of_str, is_empty } from "./common.js";

async function conf_to_sync(conf: string) {
	// console.debug(conf);
	const profile_names: string[] = [];
	const profile_names_set: Set<string> = new Set();
	const profiles: string[][] = [];
	conf
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length)
		.forEach((l) => {
			if (/^\[[^\[\],]+\]$/.test(l)) {
				const name: string = l.slice(1, -1).trim();
				profile_names.push(name);
				profile_names_set.add(name);
				profiles.push([]);
			} else {
				const lines = profiles[profiles.length - 1];
				if (lines) {
					lines.push(l);
				}
			}
		});
	if (profiles.length == 0) {
		console.warn("no profile configured");
		return;
	}

	const sync = await chrome.storage.sync.get(null);

	// remove
	const to_remove = [];
	for (const k in sync) {
		// profiles are stored in sync with a prefix
		if (k.startsWith("p.")) {
			const name = k.slice(2);
			if (!profile_names_set.has(name)) {
				console.info(`sync: profile ${k.slice(2)} is gone`);
				to_remove.push(k);
			}
		}
	}
	if (to_remove.length > 0) {
		await chrome.storage.sync.remove(to_remove);
	}

	// new/update
	const to_set: { [_: string]: string[] } = {};
	profile_names.forEach((name, i) => {
		const sync_name = `p.${name}`;
		const synced = sync[sync_name];
		const neo: string[] = profiles[i];
		let set = false;
		if (synced === undefined) {
			console.info(`sync: new profile ${name}`);
			set = true;
		} else if (!equal_array_of_str(synced as string[], neo)) {
			console.info(`sync: profile ${name} is modified`);
			set = true;
		}
		// console.debug(synced);
		// console.debug(neo);
		if (set) {
			to_set[sync_name] = neo;
		}
	});
	if (!equal_array_of_str(sync["profiles"] as string[], profile_names)) {
		to_set["profiles"] = profile_names;
	}
	if (!is_empty(to_set)) {
		await chrome.storage.sync.set(to_set);
	}

	return to_remove.length > 0 || !is_empty(to_set);
}

async function conf_from_sync_as_str(): Promise<string> {
	let sync = await chrome.storage.sync.get(null);
	if (
		!is_array_of_str(sync.profiles, 'sync["profiles"]') ||
		sync.profiles.length == 0
	) {
		return "";
	}
	const names = sync.profiles;
	const conf: string[] = [];
	names.forEach((n) => {
		const prof = sync[`p.${n}`];
		if (is_array_of_str(prof, `sync["p.${n}"]`)) {
			conf.push(`[${n}]`, ...prof);
		} else {
			console.assert(false);
		}
	});
	conf.push(""); // for the trailing new line
	return conf.join("\n");
}

function popup(parent: Node, msg: string, cb?: () => void) {
	var pop = document.createElement("div");
	pop.className = "popup";

	var div_msg = document.createElement("div");
	div_msg.appendChild(document.createTextNode(msg));
	pop.appendChild(div_msg);

	var button = document.createElement("button");
	button.appendChild(document.createTextNode("OK"));
	pop.appendChild(button);

	button.addEventListener("click", () => {
		if (cb) {
			cb();
		}
		parent.removeChild(pop);
	});
	button.addEventListener("blur", () => {
		parent.removeChild(pop);
	});

	parent.appendChild(pop);
	button.focus();
}

window.onload = async function () {
	let example_str = await read_extension_file("example.ini");
	var ex = document.getElementById("id_example") as HTMLTextAreaElement;
	// console.log("loaded example conf: \"" + example_conf + "\"");
	ex.value = example_str;

	let conf_str = await conf_from_sync_as_str();
	// console.log("loaded conf: \"" + conf + "\"");
	let conf = document.getElementById("id_conf") as HTMLTextAreaElement;
	function update_editor(c: string) {
		conf.value = c;
	}
	update_editor(conf_str === "" ? example_str : conf_str);
	conf.focus();

	// switch between conf mode and example mode
	const NORMAL_MODE_IDS = [
		"id_conf",
		"id_save",
		"id_import",
		"id_export",
		"id_revoke",
		"id_show_example",
	];
	const EXAMPLE_MODE_IDS = ["id_example", "id_hide_example"];
	button("id_show_example", () => {
		set_attr(NORMAL_MODE_IDS, "hide", "true");
		remove_attr(EXAMPLE_MODE_IDS, "hide");
	});
	button("id_hide_example", () => {
		set_attr(EXAMPLE_MODE_IDS, "hide", "true");
		remove_attr(NORMAL_MODE_IDS, "hide");
	});

	button("id_save", async () => {
		const updated = await conf_to_sync(conf.value);
		popup(document.body, updated ? "conf saved" : "no change", () => {
			window.close();
		});
	});

	button("id_import", () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".ini";
		input.onchange = async (evt) => {
			const f = (evt.target as HTMLInputElement).files;
			if (!f || !f[0]) {
				console.info("no file");
				return;
			}
			// console.log(f[0].name);
			update_editor(await f[0].text());
		};
		input.click();
	});

	button("id_export", () => {
		var a = document.createElement("a");
		a.href =
			// default to text/plain;charset=US-ASCII
			"data:text/plain;charset=UTF-8," + encodeURIComponent(conf.value);
		a.download = "config.ini";
		a.click();
	});

	button("id_revoke", async () => {
		const perms = await chrome.permissions.getAll();
		await chrome.permissions.remove({
			permissions: ["cookies"],
			origins: perms.origins,
		});
		popup(
			document.body,
			"all previously acquired optional permissions revoked",
		);
	});
};

function button(id: string, listener: () => void) {
	const btn = document.getElementById(id) as HTMLButtonElement;
	btn.addEventListener("click", listener);
}

function remove_attr(ids: string[], attr: string) {
	ids.forEach((id) =>
		(document.getElementById(id) as HTMLElement).removeAttribute(attr),
	);
}

function set_attr(ids: string[], attr: string, v: string) {
	ids.forEach((id) =>
		(document.getElementById(id) as HTMLElement).setAttribute(attr, v),
	);
}

async function read_extension_file(path: string): Promise<string> {
	// there's also chrome.runtime.getPackageDirectoryEntry
	// but api around that thing doesn't support async, yet, as of aug 2026
	const url: string = chrome.runtime.getURL(path);
	const resp = await fetch(url);
	if (!resp.ok) {
		throw new Error(
			`error fetching ${path} ${resp.status}: ${resp.statusText}`,
		);
	}
	return await resp.text();
}
