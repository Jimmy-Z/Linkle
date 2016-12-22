# Linkle - A Link Between Chrome and [aria2](https://aria2.github.io/)
Send links to
[aria2's RPC interface](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface)
via configurable [context menu](https://developer.chrome.com/extensions/contextMenus) items.

Highlights
---
* Supports multiple profiles.
	* like multiple aria2 servers.
	* or different options to a same aria2 server.
* Supports all aria2 options (if available through RPC), other tools barely supports any.
* Sync through chrome.storage.sync.

Downsides
---
* It doesn't have a configuration GUI with sliders and drop down lists,
you have to write an oldschool INI style config.
	* There is an [example](https://github.com/Jimmy-Z/Linkle/blob/master/Linkle/example.conf).
	* Hey it has syntax highlights! it's something!
	* I won't fix this.
* It has no control over the download procedure afterwards,
use a fully featured web UI like [YAAW](https://binux.github.io/yaaw/) for that.
	* I won't fix this.

Thanks
---
* [Prism](http://prismjs.com/) and
[CodeFlask](https://kazzkiq.github.io/CodeFlask.js/) for syntax highlights.
* Icon by [Freepik](http://www.flaticon.com/free-icon/download_109717).
