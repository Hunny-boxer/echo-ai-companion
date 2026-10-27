import { auth } from "./firebase";

type PersonaId = "sage" | "nova" | "atlas";
type MessageRole = "user" | "assistant";

type ChatHistoryItem = {
  role: MessageRole;
  content: string;
};

type SendChatMessageOptions = {
  message: string;
  persona: PersonaId;
  history: ChatHistoryItem[];
};

type ChatApiResponse = {
  reply?: unknown;
  detail?: unknown;
};

export async function sendChatMessage({
  message,
  persona,
  history,
}: SendChatMessageOptions): Promise<string> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("Echo's backend URL is not configured yet.");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in to continue.");
  }

  const token = await user.getIdToken();

  let response: Response;

  try {
    response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/chat`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          persona,
          history: history.slice(-12),
        }),
      }
    );
  } catch {
    throw new Error(
      "Echo couldn't reach its backend. Please try again shortly."
    );
  }

  const data = (await response.json().catch(() => ({}))) as ChatApiResponse;

  if (!response.ok) {
    const detail =
      typeof data.detail === "string" ? data.detail : "";

    throw new Error(
      detail || `Echo's server returned an error (${response.status}).`
    );
  }

  if (typeof data.reply !== "string" || !data.reply.trim()) {
    throw new Error("Echo received an empty response. Please try again.");
  }

  return data.reply.trim();
}
