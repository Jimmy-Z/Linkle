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
		if(to_be_removed.length > 0){
			chrome.storage.sync.remove(to_be_removed);
		}
		if(!is_empty(to_be_set)){
			chrome.storage.sync.set(to_be_set, () => {
				if(chrome.extension.lastError){
					console.log("chrome.extension.lastError.message");
				}
				if(cb){
					cb();
				}
			});
			chrome.runtime.sendMessage({conf: conf_object});
		}else if(cb){
			cb();
		}
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
	read_file("example.conf", example_conf => {
		var ex = document.getElementById("id_example_code");
		console.log("loaded example conf: \"" + example_conf + "\"");
		ex.textContent = example_conf;
		Prism.highlightElement(ex);
		load_conf(conf => {
			console.log("loaded conf: \"" + conf + "\"");
			flask.update(conf == "" ? example_conf : conf);
			flask.textarea.focus();
		});
	});
	function show(){
		for (var i = 0; i < arguments.length; ++i){
			document.getElementById(arguments[i]).removeAttribute("hidden");
		}
	}
	function hide(){
		for (var i = 0; i < arguments.length; ++i){
			document.getElementById(arguments[i]).setAttribute("hidden", null);
		}
	}
	document.getElementById("id_show_example").addEventListener("click", () => {
		hide("id_conf", "id_save", "id_show_example");
		show("id_example", "id_hide_example");
	});
	document.getElementById("id_hide_example").addEventListener("click", () => {
		hide("id_example", "id_hide_example");
		show("id_conf", "id_save", "id_show_example");
	});
	document.getElementById("id_save").addEventListener("click", () => {
		save_conf(flask.textarea.value, () => {
			popup(document.body, "conf saved", () => {
				window.close();
			});
		});
	});
};
