chrome.storage.sync.get(["profiles"], init);

async function init(sync: unknown) {
	const { profiles } = sync as {
		profiles?: string[];
	};
	const { intercept } = (await chrome.storage.local.get("intercept")) as {
		intercept?: string;
	};

	const list = document.getElementById("menu") as Element;

	if (profiles !== undefined) {
		for (const name of profiles) {
			const li = document.createElement("li");
			li.appendChild(document.createTextNode(name));
			if (name === intercept) {
				li.className = "selected";
			} else {
				li.addEventListener("click", async () => {
					await chrome.storage.local.set({ intercept: name });
					window.close();
				});
			}
			list.appendChild(li);
		}

		if (intercept !== undefined && profiles.includes(intercept)) {
			const off = document.createElement("li");
			off.className = "not_profile";
			off.appendChild(document.createTextNode("off"));
			off.addEventListener("click", async () => {
				await chrome.storage.local.remove("intercept");
				window.close();
			});
			list.appendChild(off);
		}
	}

	const opt = document.createElement("li");
	opt.className = "not_profile";
	opt.appendChild(document.createTextNode("config"));
	opt.addEventListener("click", async () => {
		chrome.runtime.openOptionsPage();
		window.close();
	});
	list.appendChild(opt);
}
