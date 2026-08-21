
export function equal_array_of_str(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((e, i) => e === b[i]);
}

// really, having to write this feels stupid
export function is_array_of_str(
	v: unknown,
	log_prefix?: string,
): v is string[] {
	return is_array_of(v, (e) => typeof e === "string", "string", log_prefix);
}

function is_array_of<T>(
	v: unknown,
	is_type: (e: unknown) => e is T,
	type_name: string,
	log_prefix?: string,
): v is T[] {
	if (Array.isArray(v) && v.every(is_type)) {
		return true;
	} else {
		if (log_prefix !== undefined) {
			console.warn(`${log_prefix} expecting array of ${type_name}:`, v);
		}
		return false;
	}
}

export function is_empty(o: object): boolean {
	for (const _ in o) {
		return false;
	}
	return true;
}

export function last_err(prefix: string) {
	if (chrome.runtime.lastError) {
		console.error(prefix, chrome.runtime.lastError);
	}
}

// not conventional
export function to_boolean(v: unknown): boolean {
	if (v === undefined || v === null) {
		return false;
	}
	switch (typeof v) {
		case "boolean":
			return v;
		case "string":
			switch (v.toLowerCase()) {
				case "true":
				case "on":
				case "yes":
				case "y":
					return true;
				default:
					return false;
			}
		case "number":
			return !isNaN(v) && v !== 0;
		case "bigint":
			return v !== 0n;
		default:
			return false;
	}
}
