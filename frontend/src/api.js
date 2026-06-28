const API_KEY = import.meta.env.VITE_INTERNAL_API_KEY;

const headers = {
    'Content-Type': 'application/json',
    'x-internal-key': API_KEY,
};

export async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json();
}
