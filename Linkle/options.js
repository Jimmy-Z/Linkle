"use strict";

function is_empty(o){
	for(var k in o){
		if(o.hasOwnProperty(k)){
			return false;
		}
	}
	return true;
}

function read_file(fn, cb){
	/* HTML5 FileSystem API is a rejected proposal but available on Chrome
	 * Chrome didn't provide an direct API to access files in extension
	 * so, this or XMLHttpRequest, what do you think?
	 */
	chrome.runtime.getPackageDirectoryEntry(root => {
		root.getFile(fn, {}, fe => {
			fe.file(f => {
				var reader = new FileReader();
				reader.onloadend = () =>{
					cb(reader.result);
				};
				reader.readAsText(f);
			}, e => console.log(e));
		}, e => console.log(e));
	});
}

function log_chrome_error(prefix){
	if(chrome.extension.lastError){
		console.log(prefix + chrome.extension.lastError);
	}
}

function save_conf(conf, cb){
	var profile_names = [];
	var profiles = [];
	conf.split("\n").map(l => l.trim()).filter(l => l.length).forEach(l => {
		if(/^\[[^\[\],]+\]$/.test(l)){
			profile_names.push(l.slice(1, -1).trim());
			profiles.push([]);
		}else{
			var content = profiles[profiles.length - 1];
			if(content){
				content.push(l);
			}
		}
	});
	if(profiles.length == 0){
		return;
	}
	var conf_object = {};
	profile_names.forEach((n, i) => {
		conf_object[n] = profiles[i].join("\n");
	});
	// assign this at last to make sure it won't get overwritten by a profile named "profiles"
	conf_object.profiles = profile_names.join(",");
	// TODO: exception handling
	chrome.storage.sync.get(null, r => {
		var to_be_removed = [], to_be_set = {};
		// minimize write operations to sync, since it might impact sync performance?
		for(var k in r){
			if (conf_object[k] === undefined){
				to_be_removed.push(k);
			}
		}
		for(k in conf_object){
			var v = conf_object[k];
			if(v != r[k]){
				to_be_set[k] = v;
			}
		}
		function sync_remove(removed_cb){
			if(to_be_removed.length > 0){
				chrome.storage.sync.remove(to_be_removed, () => {
					log_chrome_error("chrome.storage.sync.remove failed: ");
					removed_cb();
				});
			}else{
				removed_cb();
			}
		}
		function sync_set(set_cb){
			if(!is_empty(to_be_set)){
				chrome.storage.sync.set(to_be_set, () => {
					log_chrome_error("chrome.storage.sync.set failed: ");
					set_cb();
				});
			}else{
				set_cb();
			}
		}
		sync_remove(() => {
			sync_set(() => {
				if(cb){
					cb();
				}
			});
		});
	});
}

function load_conf(cb){
	chrome.storage.sync.get(null, r => {
		if(r.profiles == undefined || r.profiles.length == 0){
			cb("");
		}
		var names = r.profiles.split(",").filter(n => n.length);
		if(names.length > 0){
			var profiles = [];
			names.forEach(n => {
				profiles.push("[" + n + "]\n" + r[n]);
			});
			cb(profiles.join(["\n\n"]));
		}else{
			cb("");
		}
	});
}

function popup(parent, msg, cb){
	var pop = document.createElement("div");
	var div_msg = document.createElement("div");
	div_msg.appendChild(document.createTextNode(msg));
	pop.appendChild(div_msg);
	var button = document.createElement("button");
	button.appendChild(document.createTextNode("OK"));
	pop.appendChild(button);
	pop.className = "popup";
	button.addEventListener("click", () => {
		if(cb){
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

window.onload = function(){
	var flask = new CodeFlask;
	flask.run("#id_conf", {language: "ini"});
	read_file("example.ini", example_conf => {
		var ex = document.getElementById("id_example_code");
		// console.log("loaded example conf: \"" + example_conf + "\"");
		ex.textContent = example_conf;
		Prism.highlightElement(ex);
		load_conf(conf => {
			// console.log("loaded conf: \"" + conf + "\"");
			flask.update(conf == "" ? example_conf : conf);
			flask.textarea.focus();
		});
	});
	function show(ids){
		ids.forEach(id => document.getElementById(id).removeAttribute("hidden"));
	}
	function hide(ids){
		ids.forEach(id => document.getElementById(id).setAttribute("hidden", true));
	}
	const NORMAL_MODE_IDS = ["id_conf", "id_save", "id_import", "id_export", "id_revoke", "id_show_example"];
	const EXAMPLE_MODE_IDS = ["id_example", "id_hide_example"];
	document.getElementById("id_show_example").addEventListener("click", () => {
		hide(NORMAL_MODE_IDS);
		show(EXAMPLE_MODE_IDS);
	});
	document.getElementById("id_hide_example").addEventListener("click", () => {
		hide(EXAMPLE_MODE_IDS);
		show(NORMAL_MODE_IDS);
	});
	document.getElementById("id_save").addEventListener("click", () => {
		save_conf(flask.textarea.value, () => {
			popup(document.body, "conf saved", () => {
				window.close();
			});
		});
	});
	document.getElementById("id_import").addEventListener("click", () => {
		var input = document.createElement("input");
		input.type = "file";
		input.accept = ".ini";
		input.addEventListener("change", evt => {
			var f = evt.target.files[0];
			// console.log(f.name);
			var r = new FileReader();
			r.onload = e => {
				flask.update(e.target.result);
			};
			r.readAsText(f);
		});
		input.click();
	});
	document.getElementById("id_export").addEventListener("click", () => {
		/* btoa doesn't work for Unicode, an article on mozilla suggest TextEncoderLite and base64-js
		 * actually String.formCharCode then btoa works correctly for uint8Array, so no need for base64-js
		 * tested on Chrome 55 and Firefox 50, and atob then .charCodeAt also works for decoding
		 * and TextEncoder is experimental but available since Chrome 38, so no need for TextEncoderLite
		 */
		var b64 = window.btoa(String.fromCharCode.apply(null, new TextEncoder("utf-8").encode(flask.textarea.value)));
		var a = document.createElement("a");
		// it defaults to text/plain;charset=US-ASCII, while I'm actually using utf-8
		a.href = "data:application/octet-stream;base64," + b64;
		a.download = "config.ini";
		a.click();
	});
	document.getElementById("id_revoke").addEventListener("click", () => {
		chrome.permissions.getAll(perms => {
			chrome.permissions.remove({
				permissions: ["cookies"],
				origins: perms.origins
			}, () => {
				popup(document.body, "all previously acquired optional permissions have been revoked");
			});
		});
	});
};
