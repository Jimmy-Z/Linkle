// really, having to write this feels stupid
export function is_array_of_str(v: any): v is string[] {
	return is_array_of(v, (e) => typeof e === "string", "string");
}

function is_array_of<T>(
	v: any,
	is_type: (e: any) => e is T,
	type_name: string,
): v is T[] {
	if (Array.isArray(v) && v.every(is_type)) {
		return true;
	} else {
		console.error(`expecting array of ${type_name}:`, v);
		return false;
	}
}

export function is_empty(o: Object): boolean {
	for (const _ in o) {
		return false;
	}
	return true;
}

function log_chrome_error(prefix: string) {
	if (chrome.runtime.lastError) {
		console.log(prefix + chrome.runtime.lastError);
	}
}
