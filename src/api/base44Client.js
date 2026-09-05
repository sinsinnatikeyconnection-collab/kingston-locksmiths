const api = async (path, options = {}) => {
	const token = localStorage.getItem("skc_session");
	const response = await fetch(`/api/${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers || {}),
		},
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
	return body;
};

const invoke = async (name, payload) => ({
	data: await api(`functions/${name}`, {
		method: "POST",
		body: JSON.stringify(payload),
	}),
});

const collection = (name) => ({
	list: (sort, limit) => api(`entities/${name}?sort=${encodeURIComponent(sort || "-created_date")}&limit=${limit || 100}`),
	filter: (filters) => api(`entities/${name}/search`, { method: "POST", body: JSON.stringify(filters) }),
	get: (id) => api(`entities/${name}/${id}`),
	create: (payload) => api(`entities/${name}`, { method: "POST", body: JSON.stringify(payload) }),
	update: (id, payload) => api(`entities/${name}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
	delete: (id) => api(`entities/${name}/${id}`, { method: "DELETE" }),
	subscribe: () => () => {},
});

/** @type {any} */
const entities = new Proxy({}, { get: (_target, name) => collection(String(name)) });

export const db = {
	auth: {
		isAuthenticated: async () => Boolean(localStorage.getItem("skc_session")),
		me: async () => api("auth/me"),
		loginViaEmailPassword: async (email, password) => {
			const result = await api("auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
			if (result.access_token) localStorage.setItem("skc_session", result.access_token);
			return result;
		},
		register: (payload) => api("auth/register", { method: "POST", body: JSON.stringify(payload) }),
		verifyOtp: (payload) => api("auth/verify-otp", { method: "POST", body: JSON.stringify(payload) }),
		resendOtp: (email) => api("auth/resend-otp", { method: "POST", body: JSON.stringify({ email }) }),
		resetPasswordRequest: (email) => api("auth/reset-password-request", { method: "POST", body: JSON.stringify({ email }) }),
		resetPassword: (payload) => api("auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
		setToken: (token) => localStorage.setItem("skc_session", token),
		loginWithProvider: (provider, returnTo = "/") => {
			window.location.assign(`/api/auth/provider/${encodeURIComponent(provider)}?returnTo=${encodeURIComponent(returnTo)}`);
		},
		logout: () => {
			localStorage.removeItem("skc_session");
			window.location.assign("/login");
		},
		redirectToLogin: () => { window.location.assign("/login"); },
	},
	entities: entities,
	functions: { invoke },
	integrations: {
		Core: {
			UploadFile: async ({ file }) => {
				const body = new FormData();
				body.append("file", file);
				const response = await fetch("/api/uploads", { method: "POST", body });
				if (!response.ok) throw new Error("Upload failed");
				return response.json();
			},
		},
	},
};

export const base44 = db;
export default db;