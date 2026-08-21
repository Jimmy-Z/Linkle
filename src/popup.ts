chrome.storage.sync.get(["intercept", "profiles"], init);

async function init(sync: unknown) {
	const { intercept, profiles } = sync as {
		intercept: string | undefined;
		profiles: string[];
	};

	const list = document.getElementById("menu") as Element;

	for (const name of profiles as string[]) {
		const li = document.createElement("li");
		li.appendChild(document.createTextNode(name));
		if (name === intercept) {
			li.className = "selected";
		} else {
			li.addEventListener("click", async () => {
				await chrome.storage.sync.set({ intercept: name });
				window.close();
			});
		}
		list.appendChild(li);
	}

	// list.appendChild(document.createElement("hr"));

	if (intercept !== undefined && profiles.includes(intercept)) {
		const off = document.createElement("li");
		off.appendChild(document.createTextNode("off"));
		off.addEventListener("click", async () => {
			await chrome.storage.sync.remove("intercept");
			window.close();
		});
		list.appendChild(off);
	}

	list.appendChild(document.createElement("hr"));

	const opt = document.createElement("li");
	opt.appendChild(document.createTextNode("config"));
	opt.addEventListener("click", async () => {
		chrome.runtime.openOptionsPage();
		window.close();
	});
	list.appendChild(opt);
}
