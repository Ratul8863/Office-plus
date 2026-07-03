const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || `API request failed with status ${response.status}`);
  }

  return result.data as T;
}
