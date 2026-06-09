const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "An error occurred while fetching data");
  }

  return data;
}