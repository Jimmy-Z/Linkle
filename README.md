# CAUTION! the project has gone through a major rewrite
due to internal data structure changes, export your conf before updating and import after.

# Linkle
Send links to
[aria2](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface)
or [qBittorrent](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)).

Install
---
until I setup github actions,
you'll have to have node installed and then:
```sh
npm install
npx tsc
```
then load unpacked extension in chrome

Highlights
---
* Supports multiple profiles.
	* like multiple download servers.
	* or to a same aria2 server but with different options.
* Supports all aria2/qBittorrent options, if available through RPC.
* Write old school ini style configuration, with export/import and
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
* Cookie handling (aria2)
	* Linkle will send all cookies on current page (frame).
		* if it matches link host.
		* it's good for common situation, and it doesn't require extra permissions.

To do
---
- [ ] intercept download
- [ ] ACE
- [ ] port dropped cookie handling code back
	- [ ] link cookie
	- [ ] specified cookie

Thanks
---
* Icon by [Freepik](http://www.flaticon.com/free-icon/download_109717).
