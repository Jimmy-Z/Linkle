# Linkle - A Link Between Chrome and [aria2](https://aria2.github.io/)
Send links to
[aria2's RPC interface](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface)
via configurable [context menu](https://developer.chrome.com/extensions/contextMenus) items.

Install
---
[Chrome web store](https://chrome.google.com/webstore/detail/linkle/okcgleaeeoddghoiabpapmnkckncbjba)

Highlights
---
* Supports multiple profiles.
	* like multiple aria2 servers.
	* or different options to a same aria2 server.
* Supports all aria2 options, if available through RPC.
* Sync through [chrome.storage.sync](https://developer.chrome.com/extensions/storage#property-sync).

Downsides
---
* It doesn't have a configuration GUI with flip switches and sliders,
you have to write old school INI style config.
	* There is an [example](https://github.com/Jimmy-Z/Linkle/blob/master/Linkle/example.conf).
	* Hey it has syntax highlights! [it's something!](http://knowyourmeme.com/memes/its-something)
	* I won't fix this.
* It has no control over the download procedure afterwards,
use a fully featured web UI like [YAAW](https://binux.github.io/yaaw/) for that.
	* I won't fix this.

Cookie handling
---
* by default Linkle will send all cookies on current page.
	* it's good for most situation, and it doesn't require extra permissions.
	* but sometimes link and page are not on the same host/domain and the link requires different cookies.
	Linkle won't send cookie if link and page are not on the same domain.
* if you set `cookie = link`, Linkle will get cookies exactly for the link you click.
	* require extra permissions, Chrome will present you a popup about this.
	* but it still doesn't work sometimes, since the link might redirect to a different host/domain and then it requires different cookies.
	Tip: click the link, let chrome download it, the final/redirected link will show up in [chrome://downloads](chrome://downloads).
* if you set `cookie = COOKIE1@http://example.com COOKIE2@http://example.com`, Linkle will get those cookies specifically.
	* require extra permissions too.
	* yeah this is hacky.

Change log
---
* 0.0.1 aria2 RPC support.
* 0.0.2 general RPC support.
* 0.1.0 the option page, before this point Linkle was private work and config is hardcoded.
* 0.1.1 cookie handling.
* 0.1.2 cookie handling using optional permissions.
* 0.1.3 beautify with Prism and CodeFlask.js.
* 0.1.3.1 hotfix for not loading default on first run.
* 0.1.4 config import/export and some bug fixes around initializing and cookie handling.
* 0.1.5 additional cookie handling method and again initialization bug fix.
* 0.1.6 I think I finally got "nothing happens when clicked" fixed properly.
* 0.1.7 more verbose via notification and cookie handling fix again.
* 0.1.8 a button in options page to revoke permissions,
and a fix for cookie handling breakage caused by notification introduced in 0.1.7.
* 0.1.9 handles sync properly.

Thanks
---
* [Prism](http://prismjs.com/) and
[CodeFlask.js](https://kazzkiq.github.io/CodeFlask.js/) for syntax highlights.
* Icon by [Freepik](http://www.flaticon.com/free-icon/download_109717).
