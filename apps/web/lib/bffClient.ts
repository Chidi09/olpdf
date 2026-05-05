export async function bffGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BFF GET failed: ${response.status}`);
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
    throw new Error(`BFF POST failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
