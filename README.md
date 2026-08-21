# CAUTION! the project has gone through a major rewrite recently
due to internal data structure changes, export your conf before updating and import after.

# Linkle
a chrome extension to send downloads to
[aria2](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface)
or [qBittorrent](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)).

right click on links or intercept chrome downloads.

Install
---
until I setup github actions,
you'll have to download source, install node and then:
```sh
npm install
npx tsc
```
then load unpacked extension in chrome

Highlights
---
* Supports multiple profiles.
	* like multiple download servers.
	* or to the same server but with different options.
* Quick switching.
* Supports all aria2/qBittorrent options, if available through RPC.
* Write old school ini style configuration, with export/import and:
* Sync through [chrome.storage.sync](https://developer.chrome.com/extensions/storage#property-sync).

Downsides
---
* It doesn't have a configuration GUI with flip switches and sliders
	* I won't fix this.
* It has no control over the download procedure afterwards
	* maybe use another web UI for that.
	* I won't fix this.

notes
---
* click the icon to choose which profile to use for intercepting.
* actually chrome has no "download intercepting" api,
	there's download _managing_ api.
	* what linkle (and most likely other extensions too) actually does:
		* gets notified when a download starts
		* stop it
		* erase it from download history
		* send it
	* so it's normal to see the animation indicating chrome started a download.
	* theoretically if the website generates a link that can only be accessed once,
		this method will fail.
* there's a "request" button in options,
	it will ask for permission for all data on all sites,
	otherwise cookie functions will fail.
	of course you could choose not to do that if you don't need cookies.
	previously linkle only asks for permission for specific sites when required.
	this change is due to two reasons:
	* since the introduction of download intercepting in 0.3.2.
		chrome only allows requesting optional permission upon user interaction,
		it won't work in download intercepting.
		yeah, I _could_ preserve old behavior when not intercepting,
		but it's a hassle, and ...
	* that "allows ... upon user interaction" is apparently buggy in async.
	

To do
---
- ACE

Thanks
---
* Icon by [Freepik](http://www.flaticon.com/free-icon/download_109717).
