export class BffHttpError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.isAuthError = status === 401;
  }
}

async function extractErrorMessage(response: Response, label: string): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      if (typeof body.detail === "string") return body.detail;
      if (typeof body.message === "string") return body.message;
    }
  } catch {
    // ignore parse errors
  }
  return `${label} failed: ${response.status}`;
}

export async function bffGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const msg = await extractErrorMessage(response, "BFF GET");
    throw new BffHttpError(msg, response.status);
  }

  return response.json() as Promise<T>;
}

export async function bffPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const msg = await extractErrorMessage(response, "BFF POST");
    throw new BffHttpError(msg, response.status);
  }

  return response.json() as Promise<T>;
}
