const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.warn("[checkout-api] NEXT_PUBLIC_API_URL não definida.");
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: string }).error)
        : null) ?? `Erro ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      (data && typeof data === "object"
        ? String(
            ("message" in data && (data as { message?: string }).message) ||
              ("error" in data && (data as { error?: string }).error) ||
              ""
          )
        : "") || `Erro ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
