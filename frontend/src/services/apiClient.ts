const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();

  let result: { success?: boolean; message?: string; data?: T } | null = null;
  if (rawBody) {
    if (contentType.includes("application/json")) {
      try {
        result = JSON.parse(rawBody) as {
          success?: boolean;
          message?: string;
          data?: T;
        };
      } catch {
        throw new Error(`Invalid JSON response from ${path} (${response.status})`);
      }
    } else if (!response.ok) {
      throw new Error(`API request to ${path} failed with status ${response.status}`);
    } else {
      throw new Error(`Unexpected non-JSON response from ${path}`);
    }
  }

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message || `API request to ${path} failed with status ${response.status}`,
    );
  }

  return result.data as T;
}
