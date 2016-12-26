"use strict";

function xhr(method, url, data, callback){
	var x = new XMLHttpRequest();
	x.onreadystatechange = function(){
		if(x.readyState == 4){
			if(x.status == 200 || x.status == 204){
				callback(x.responseText);
			}else{
				console.error(method, url, x.status, x.statusText, x.responseText);
			}
		}
	};
	x.open(method, url);
	x.send(data);
}

function a2rpc(uri, token, method, args, callback){
	var post_data = JSON.stringify({
		jsonrpc: "2.0",
		id: Math.random().toString(),
		method: "aria2." + method,
		params: (token != null ? ["token:" + token] : []).concat(args)
	});
	xhr("POST", uri, post_data, r => callback(JSON.parse(r)));
}

function a2addUri(uri, token, uris, options, callback){
	// we should probably validate options here
	// like stripping out HTTP only options for FTP or magnet links
	// but anyway aria2 didn't complain about that
	a2rpc(uri, token, "addUri", [uris, options], callback);
}

function xhr_stream(method, url, data, callback){
	var x = new XMLHttpRequest();
	x.onreadystatechange = function(){
		/*
		console.log("XHR readyState: " +
			(["unsent", "opened", "headers received", "loading", "done"][x.readyState]) + "\n" + x.responseText);
			*/
		if(x.readyState < 3 || x.status != 200){
			return;
		}
		callback(x.responseText);
	};
	x.open("POST", url);
	x.send(data);
}

function dedupe(a){
	var o = {};
	a.forEach(e => o[e] = true);
	return Object.keys(o);
}

function is_http(u){ // or https
	return /^https?:\/\//i.test(u);
}

// TODO: handle authentication section
function extract_host(u){
	return /^https?:\/\/[\.\-0-9a-z]+/i.exec(u)[0];
}

function extract_domain(u){
	return /^https?:\/\/([\.\-0-9a-z]+\.)?([\-0-9a-z]+\.[\-0-9a-z]+)/i.exec(u)[2];
}

// only requires "activeTab" permission, but page cookie only
function get_page_cookie(page_url, urls, cb){
	// if page_url is not http(s), it would never work
	if(!is_http(page_url)){
		cb();
		return;
	}
	// it will be meaningless if page_url doesn't match
	var page_domain = extract_domain(page_url);
	if(!urls.some(u => {
		return extract_domain(u) == page_domain;
	})){
		cb();
		return;
	}
	chrome.tabs.executeScript({code: "document.cookie"}, (r) => {
		if(chrome.runtime.lastError){
			chrome.log("chrome.tabs.executeScript failed: " + chrome.runtime.lastError.message);
		}
		cb(r);
	});
}

// requires "cookie" and site permission
function get_cookies_parallel(urls, cb){
	var ret = {}, count = urls.length;
	urls.forEach(url => {
		chrome.cookies.getAll({"url": url}, r => {
			ret[url] = r;
			--count;
			if(count == 0){
				cb(ret);
			}
		});
	});
}

function get_cookies(cookie_setting, page_url, urls, cb){
	urls = urls.filter(is_http);
	if(urls.length == 0){
		cb();
	}else if (cookie_setting == "link"){
		var perm = {
			permissions: ["cookies"],
			origins: dedupe(urls.map(extract_host))
		};
		chrome.permissions.request(perm, granted => {
			if (granted){
				get_cookies_parallel(urls, r => {
					chrome.permissions.remove(perm);
					// since aria2 doesn't allow different header for multiple links
					// I'm gonna merge them here
					// oh, that's for future multiple links support
					var cookie = {};
					[].concat.apply([], Object.values(r)).forEach(c => {
						// use object to dedupe
						cookie[c.name] = c.value;
					});
					cb(Object.keys(cookie).map(n => n + "=" + cookie[n]).join("; "));
				});
			}else{
				console.log("permission requrest declined, fallback to page cookie instead");
				get_page_cookie(page_url, urls, cb);
			}
		});
	}else{
		get_page_cookie(page_url, urls, cb);
	}
}

function linkle(profile, info){
	if(profile.type == "aria2"){
		var frag = info.pageUrl.indexOf("#");
		var o = {referer: frag == -1 ? info.pageUrl : info.pageUrl.slice(0, frag)};
		for(var k in profile){
			if (["name", "type", "link_patterns", "aria2_uri", "aria2_token", "redirect", "cookie"].indexOf(k) == -1){
				o[k] = profile[k];
			}
		}
		get_cookies(profile.cookie, info.pageUrl, [info.linkUrl], r => {
			console.log("cookies: \"" + r + "\"");
			if(r != undefined && r.length > 0){
				if(o.header == undefined){
					o.header = ["Cookie: " + r];
				}else{
					o.header.push("Cookie: " + r);
				}
			}
			var url = profile.redirect == undefined ? info.linkUrl : profile.redirect;
			a2addUri(profile.aria2_uri, profile.aria2_token, [url], o, function(r){
				// console.log("aria2.addUri returned:", r.result);
				chrome.notifications.create(null, {
					type: "basic",
					iconUrl: "icon.png",
					title: profile.name,
					message: "download added, GID = " + r.result
				});
			});
		});
	}else if(profile.type == "rpc"){
		var nid = null;
		xhr_stream("POST", profile.rpc_uri, info.linkUrl, function(r){
			// console.log(profile.name + " returned:", r);
			// seems like list notification only show 5 items
			// TODO: handle carriage return and color codes
			r = r.split("\n").map(l => l.trim()).filter(l => l.length).slice(-5).map(l => ({title: "", message: l}));
			if(nid == null){
				chrome.notifications.create(null, {
					type: "list",
					iconUrl: "icon.png",
					title: profile.name,
					message: "",
					items: r
				}, rnid => nid = rnid);
			}else{
				chrome.notifications.update(nid, { items: r });
			}
		});
	}else{
		console.log("unknown profile: \"" + profile.type + "\"");
	}
}

function linkle_onClicked(info){
	console.log(info.menuItemId, info.linkUrl);
	chrome.storage.sync.get(info.menuItemId, r => {
		var p = parse_profile(info.menuItemId, r[info.menuItemId]);
		if(p == null){
			return;
		}
		linkle(p, info);
	});
}

function parse_profile(n, c){
	if(c == undefined || c.length == 0){
		return null;
	}
	var p = {};
	// split line and remove comments
	c = c.split("\n").filter(l => l.length && l[0] != ";");
	c.forEach(l => {
		var sep = l.indexOf("=");
		if(sep == -1){
			return;
		}
		var k = l.slice(0, sep).trim();
		var v = l.slice(sep + 1).trim();
		// multiple header and index-out lines are possible for aria2
		if(p.type == "aria2" && ["header", "index-out"].indexOf(k) != -1){
			if(p[k] == undefined){
				p[k] = [v];
			}else{
				p[k].push(v);
			}
		}else{
			p[k] = v;
		}
	});
	p.name = n;
	// TODO: validate the profile
	return p;
}

function parse_conf(conf){
	if(conf.profiles == undefined || conf.profiles.length == 0){
		return [];
	}
	// save_conf in options.js should have already trimed space/filtered empty
	var names = conf.profiles.split(",");
	if(names.length == 0){
		return [];
	}
	var profiles = [];
	names.forEach(n => {
		var p = parse_profile(n, conf[n]);
		if(p != null){
			profiles.push(p);
		}
	});
	return profiles;
}

function linkle_install(profiles){
	if(profiles.length == 0){
		console.log("no profile found");
		return;
	}
	profiles.forEach(p => {
		console.log("installing profile \"" + p.name + "\"");
		chrome.contextMenus.create({
			id: p.name,
			title: p.name,
			contexts: ["link"],
			// documentUrlPatterns: p.doc_patterns.split(" "),
			targetUrlPatterns: p.link_patterns.split(" ")
		}, () => {
			if(chrome.runtime.lastError){
				console.log("failed to create contextMenu \"" +
					p.name + "\": " + chrome.runtime.lastError.message);
			}
		});
	});
	chrome.contextMenus.onClicked.addListener(linkle_onClicked);
}

chrome.storage.sync.get(null, r => {
	linkle_install(parse_conf(r), false);
});
