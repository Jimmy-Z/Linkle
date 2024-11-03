"use strict";

// since xhr is deprecated, this a polyfill
function xhr(method, url, data, callback) {
	fetch(url, { method: method, body: data })
		.then(r => {
			if (r.status == 200 || r.status == 204) {
				return r.text();
			} else {
				console.error(method, url, r.status, r.statusText);
			}
		}, e => console.error(method, url, e))
		.then(r => callback(r), e => console.error(method, url, e));
}

function a2rpc(uri, token, method, args, callback) {
	var post_data = JSON.stringify({
		jsonrpc: "2.0",
		id: Math.random().toString(),
		method: "aria2." + method,
		params: (token != null ? ["token:" + token] : []).concat(args)
	});
	xhr("POST", uri, post_data, r => callback(JSON.parse(r)));
}

function a2addUri(uri, token, uris, options, callback) {
	// we should probably validate options here
	// like stripping out HTTP only options for FTP or magnet links
	// but anyway aria2 didn't complain about that
	a2rpc(uri, token, "addUri", [uris, options], callback);
}

function dedupe(a) {
	var o = {};
	a.forEach(e => o[e] = true);
	return Object.keys(o);
}

function is_http(u) { // or https
	return /^https?:\/\//i.test(u);
}

// TODO: handle authentication section
function extract_host(u) {
	return /^https?:\/\/[\.\-0-9a-z]+/i.exec(u)[0] + "/";
}

function extract_domain(u) {
	return /^https?:\/\/([\.\-0-9a-z]+\.)?([\-0-9a-z]+\.[\-0-9a-z]+)/i.exec(u)[2];
}

// only requires "activeTab" permission, but page cookie only
function get_page_cookie(page_url, urls, cb) {
	// if page_url is not http(s), it would never work
	if (!is_http(page_url)) {
		cb();
		return;
	}
	// it will be meaningless if page_url doesn't match
	var page_domain = extract_domain(page_url);
	if (!urls.some(u => {
		return extract_domain(u) == page_domain;
	})) {
		cb();
		return;
	}
	chrome.tabs.executeScript({ code: "document.cookie" }, (r) => {
		if (chrome.runtime.lastError) {
			chrome.log("chrome.tabs.executeScript failed: " + chrome.runtime.lastError.message);
			cb();
		} else {
			cb(r[0]);
		}
	});
}

// requires "cookie" and site permission
function get_cookies_parallel(urls, descs, cb) {
	var ret = [], cookies = {};
	if (descs == undefined) {
		urls.forEach(url => {
			chrome.cookies.getAll({ url: url }, r => {
				if (chrome.runtime.lastError) {
					console.log("chrome.cookies.getAll failed: " + chrome.runtime.lastError.message);
				}
				console.log("chrome.cookies.getAll returned for \"" + url + "\": "
					+ JSON.stringify(r));
				ret.push(r);
				if (ret.length == urls.length) {
					// since aria2 doesn't allow different header for multiple links
					// I'm gonna merge them here
					// oh, that's for future multiple links support
					[].concat.apply([], ret).forEach(c => cookies[c.name] = c.value);
					cb(cookies);
				}
			});
		});
	} else {
		descs.forEach(desc => {
			chrome.cookies.get(desc, r => {
				if (chrome.runtime.lastError) {
					console.log("chrome.cookies.get failed: " + chrome.runtime.lastError.message);
				}
				console.log("chrome.cookies.get returned: "
					+ JSON.stringify(r));
				ret.push(r);
				if (ret.length == descs.length) {
					ret.forEach(c => cookies[c.name] = c.value);
					cb(cookies);
				}
			});
		});
	}
}

function get_cookies(cookie_setting, page_url, urls, cb) {
	urls = urls.filter(is_http);
	if (urls.length == 0) {
		cb();
	} else if (cookie_setting == undefined) {
		get_page_cookie(page_url, urls, cb);
	} else {
		if (cookie_setting == "link") {
			var perm = {
				permissions: ["cookies"],
				origins: dedupe(urls.map(extract_host))
			};
		} else { // cookie = COOKIE1@http://example1.com/ COOKIE2@example2.com/
			var cookie_descs = cookie_setting.split(" ").map(c => {
				var m = /(.*)@(.*)/.exec(c);
				if (m == null) {
					return null;
				} else {
					return { name: m[1], url: m[2] };
				}
			}).filter(c => c != null);
			perm = {
				permissions: ["cookies"],
				origins: dedupe(cookie_descs.map(d => d.url))
			};
		}
		console.log("requesting optional permissions: " + JSON.stringify(perm));
		chrome.permissions.request(perm, granted => {
			if (chrome.runtime.lastError) {
				// I've seen a weird exception here, but never get to see it again
				console.log("chrome.permissions.request failed: " + chrome.runtime.lastError.message);
			}
			if (granted) {
				get_cookies_parallel(urls, cookie_descs, r => {
					chrome.permissions.remove(perm);
					cb(Object.keys(r).map(n => n + "=" + r[n]).join("; "));
				});
			} else {
				console.log("permission request declined, fallback to page cookie instead");
				get_page_cookie(page_url, urls, cb);
			}
		});
	}
}

function linkle(profile, info, nid, n_items) {
	if (profile.type == "aria2") {
		var frag = info.pageUrl.indexOf("#");
		var o = { referer: frag == -1 ? info.pageUrl : info.pageUrl.slice(0, frag) };
		for (var k in profile) {
			if (["name", "type", "link_patterns", "aria2_uri", "aria2_token", "redirect", "cookie"].indexOf(k) == -1) {
				o[k] = profile[k];
			}
		}
		get_cookies(profile.cookie, info.pageUrl, [info.linkUrl], r => {
			if (r != undefined && r.length > 0) {
				if (o.header == undefined) {
					o.header = ["Cookie: " + r];
				} else {
					o.header.push("Cookie: " + r);
				}
				n_items.push({ title: "cookie", message: r });
				chrome.notifications.update(nid, { items: n_items });
			}
			var url = profile.redirect == undefined ? info.linkUrl : profile.redirect;
			a2addUri(profile.aria2_uri, profile.aria2_token, [url], o, function (r) {
				// console.log("aria2.addUri returned:", r.result);
				n_items.push({ title: "GID", message: r.result });
				chrome.notifications.update(nid, { items: n_items });
			});
		});
	} else {
		console.log("unknown profile: \"" + profile.type + "\"");
	}
}

function linkle_onClicked(info) {
	let nid = info.menuItemId + " " + Math.random();
	// since notifications.update is overwriting this item list, I'm passing it down
	let n_items = [{ title: "", message: info.linkUrl }];
	chrome.notifications.create(nid, {
		type: "list",
		// I really need a better looking icon
		iconUrl: "icon.png",
		title: info.menuItemId,
		message: "",
		items: n_items
	});
	chrome.storage.sync.get(info.menuItemId, r => {
		var p = parse_profile(info.menuItemId, r[info.menuItemId]);
		if (p == null) {
			n_items.push({ title: "", message: "error parsing profile" });
			chrome.notifications.update(nid, { items: n_items });
		}
		linkle(p, info, nid, n_items);
	});
}

function parse_profile(n, c) {
	if (c == undefined || c.length == 0) {
		return null;
	}
	var p = {};
	// split line and remove comments
	c = c.split("\n").filter(l => l.length && l[0] != ";");
	c.forEach(l => {
		var sep = l.indexOf("=");
		if (sep == -1) {
			return;
		}
		var k = l.slice(0, sep).trim();
		var v = l.slice(sep + 1).trim();
		// multiple header and index-out lines are possible for aria2
		if (p.type == "aria2" && ["header", "index-out"].indexOf(k) != -1) {
			if (p[k] == undefined) {
				p[k] = [v];
			} else {
				p[k].push(v);
			}
		} else {
			p[k] = v;
		}
	});
	p.name = n;
	// TODO: validate the profile
	return p;
}

function parse_conf(conf) {
	if (conf.profiles == undefined || conf.profiles.length == 0) {
		return [];
	}
	// save_conf in options.js should have already trimmed space/filtered empty
	var names = conf.profiles.split(",");
	if (names.length == 0) {
		return [];
	}
	var profiles = [];
	names.forEach(n => {
		var p = parse_profile(n, conf[n]);
		if (p != null) {
			profiles.push(p);
		}
	});
	return profiles;
}

function make_context_menu_properties(profile) {
	return {
		id: profile.name,
		title: profile.name,
		contexts: ["link"],
		targetUrlPatterns: profile.link_patterns.split(" ")
	};
}

function linkle_onInstalled() {
	chrome.storage.sync.get(null, r => {
		let profiles = parse_conf(r);
		if (profiles.length == 0) {
			chrome.tabs.create({ "url": "chrome://extensions/?options=" + chrome.runtime.id });
			return;
		}
		profiles.forEach(p => {
			console.log("creating menu \"" + p.name + "\"");
			chrome.contextMenus.create(make_context_menu_properties(p), () => {
				if (chrome.runtime.lastError) {
					console.log("failed to create contextMenu \"" +
						p.name + "\": " + chrome.runtime.lastError.message);
				}
			});
		});
	});
}

function linkle_onChanged(changes) {
	console.log("onChange:\n" + (Object.keys(changes).map(k => k + ": " + JSON.stringify(changes[k])).join("\n")));
	for (let k in changes) {
		if (k == "profiles") {
			continue;
		}
		let err_cb = function () {
			if (chrome.runtime.lastError) {
				console.log("failed to create/update/remove contextMenu \"" +
					k + "\": " + chrome.runtime.lastError.message);
			}
		};
		let v = changes[k];
		if (v.newValue !== undefined) {
			let p = make_context_menu_properties(parse_profile(k, v.newValue));
			if (v.oldValue === undefined) {
				console.log("creating menu \"" + k + "\"");
				chrome.contextMenus.create(p, err_cb);
			} else {
				delete p.id;
				console.log("updating menu \"" + k + "\"");
				chrome.contextMenus.update(k, p, err_cb);
			}
		} else {
			console.log("removing menu \"" + k + "\"");
			chrome.contextMenus.remove(k, err_cb);
		}
	}
}

chrome.runtime.onInstalled.addListener(linkle_onInstalled);

chrome.contextMenus.onClicked.addListener(linkle_onClicked);

chrome.storage.onChanged.addListener(linkle_onChanged);
