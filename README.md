# Linkle - A Link Between Chrome and [aria2](https://aria2.github.io/)
Send links to
[aria2's RPC interface](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface)
via configurable [context menu](https://developer.chrome.com/extensions/contextMenus) items.

Install
---
~~[Chrome web store](https://chrome.google.com/webstore/detail/linkle/okcgleaeeoddghoiabpapmnkckncbjba)~~

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
use a fully featured web UI like [AriaNg](https://github.com/mayswind/AriaNg) for that.
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

To do
---
- [ ] qBittorrent support
- [ ] migrate to ACE
- [ ] modernization: await/async instead of callbacks

Thanks
---
* [Prism](http://prismjs.com/) and
[CodeFlask.js](https://kazzkiq.github.io/CodeFlask.js/) for syntax highlights.
* Icon by [Freepik](http://www.flaticon.com/free-icon/download_109717).
