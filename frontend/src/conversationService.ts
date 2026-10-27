import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export type PersonaId = "sage" | "nova" | "atlas";
export type MessageRole = "user" | "assistant";

export type SavedConversation = {
  id: string;
  title: string;
  persona: PersonaId;
  createdAt: number;
  updatedAt: number;
};

export type SavedMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
};

function requireUserId(): string {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("Please sign in to access your conversations.");
  }

  return uid;
}

function timestampToMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    const timestamp = value as Timestamp;
    return timestamp.toMillis();
  }

  return Date.now();
}

function isPersonaId(value: unknown): value is PersonaId {
  return value === "sage" || value === "nova" || value === "atlas";
}

function isMessageRole(value: unknown): value is MessageRole {
  return value === "user" || value === "assistant";
}

export async function createConversation(
  title: string,
  persona: PersonaId
): Promise<string> {
  const uid = requireUserId();

  const conversationRef = await addDoc(
    collection(db, "users", uid, "conversations"),
    {
      title: title.trim().slice(0, 100) || "New conversation",
      persona,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return conversationRef.id;
}

export async function saveConversationMessage(
  conversationId: string,
  role: MessageRole,
  content: string
): Promise<void> {
  const uid = requireUserId();
  const cleanContent = content.trim();

  if (!conversationId.trim()) {
    throw new Error("A conversation ID is required.");
  }

  if (!cleanContent || cleanContent.length > 4000) {
    throw new Error("Message must contain between 1 and 4000 characters.");
  }

  const conversationRef = doc(
    db,
    "users",
    uid,
    "conversations",
    conversationId
  );

  await addDoc(collection(conversationRef, "messages"), {
    role,
    content: cleanContent,
    createdAt: serverTimestamp(),
  });

  await updateDoc(conversationRef, {
    updatedAt: serverTimestamp(),
  });
}

export async function listConversations(): Promise<SavedConversation[]> {
  const uid = requireUserId();

  const conversationsQuery = query(
    collection(db, "users", uid, "conversations"),
    orderBy("updatedAt", "desc"),
    limit(30)
  );

  const snapshot = await getDocs(conversationsQuery);

  return snapshot.docs.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      title:
        typeof data.title === "string"
          ? data.title
          : "New conversation",
      persona: isPersonaId(data.persona) ? data.persona : "sage",
      createdAt: timestampToMillis(data.createdAt),
      updatedAt: timestampToMillis(data.updatedAt),
    };
  });
}

export async function loadConversationMessages(
  conversationId: string
): Promise<SavedMessage[]> {
  const uid = requireUserId();

  const messagesQuery = query(
    collection(
      db,
      "users",
      uid,
      "conversations",
      conversationId,
      "messages"
    ),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  const snapshot = await getDocs(messagesQuery);

  return snapshot.docs.flatMap((item) => {
    const data = item.data();

    if (
      !isMessageRole(data.role) ||
      typeof data.content !== "string"
    ) {
      return [];
    }

    return [
      {
        id: item.id,
        role: data.role,
        content: data.content,
        createdAt: timestampToMillis(data.createdAt),
      },
    ];
  });
}
