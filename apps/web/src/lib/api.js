const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    credentials: "include",
    body:
      options.body === undefined || options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body),
  });

  if (options.responseType === "blob") {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Error desconocido." }));
      throw new Error(error.error ?? "Error al descargar archivo.");
    }

    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Error inesperado.");
  }

  return data;
}

