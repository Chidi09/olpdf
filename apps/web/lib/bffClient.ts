export class BffHttpError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.isAuthError = status === 401;
  }
}

export async function bffGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new BffHttpError(`BFF GET failed: ${response.status}`, response.status);
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
    throw new BffHttpError(`BFF POST failed: ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}
