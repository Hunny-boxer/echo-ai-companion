
import { auth } from "./firebase";

export type MemoryCategory =
  | "personal"
  | "preference"
  | "work"
  | "other";

export type SavedMemory = {
  id: string;
  content: string;
  category: MemoryCategory;
  created_at: string | null;
  updated_at: string | null;
};

type MemoryPayload = {
  content: string;
  category: MemoryCategory;
};

type ApiError = {
  detail?: unknown;
};

async function memoryRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("Echo's backend URL is not configured.");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in to manage your memories.");
  }

  const token = await user.getIdToken();
  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/memories${path}`,
      {
        ...options,
        headers,
      }
    );
  } catch {
    throw new Error(
      "Echo couldn't reach its memory service. Please try again."
    );
  }

  const data = (await response.json().catch(() => ({}))) as
    | T
    | ApiError;

  if (!response.ok) {
    const detail =
      "detail" in data && typeof data.detail === "string"
        ? data.detail
        : "";

    throw new Error(
      detail ||
        `Memory service returned an error (${response.status}).`
    );
  }

  return data as T;
}

export async function listMemories(): Promise<SavedMemory[]> {
  const result = await memoryRequest<unknown>("");

  if (!Array.isArray(result)) {
    throw new Error("Echo received an invalid memory list.");
  }

  return result as SavedMemory[];
}

export async function createMemory(
  payload: MemoryPayload
): Promise<SavedMemory> {
  return memoryRequest<SavedMemory>("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMemory(
  memoryId: string,
  payload: Partial<MemoryPayload>
): Promise<SavedMemory> {
  return memoryRequest<SavedMemory>(
    `/${encodeURIComponent(memoryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMemory(
  memoryId: string
): Promise<void> {
  await memoryRequest<{ deleted: boolean; id: string }>(
    `/${encodeURIComponent(memoryId)}`,
    {
      method: "DELETE",
    }
  );
}
