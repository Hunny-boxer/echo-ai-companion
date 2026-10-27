
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import EchoAvatar, {
  type EchoAvatarExpression,
  type EchoAvatarState,
} from "./EchoAvatar";
import { sendChatMessage } from "./chatService";
import {
  createConversation,
  listConversations,
  loadConversationMessages,
  saveConversationMessage,
} from "./conversationService";
import type {
  SavedConversation,
  PersonaId as StoredPersonaId,
  MessageRole,
} from "./conversationService";

const personas = [
  {
    id: "sage",
    name: "Sage",
    role: "Calm & thoughtful",
    description:
      "A calm presence for reflection and meaningful conversations. Sage helps you slow down, think clearly, and find balance.",
    avatar: "✦",
    color: "lilac",
    traits: ["Thoughtful", "Patient", "Grounded"],
  },
  {
    id: "nova",
    name: "Nova",
    role: "Playful & curious",
    description:
      "A bright, expressive companion for ideas, stories, creative experiments, and everyday discoveries.",
    avatar: "✷",
    color: "peach",
    traits: ["Curious", "Playful", "Creative"],
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Motivating & grounded",
    description:
      "A focused, dependable companion for organizing goals, solving problems, and moving projects forward.",
    avatar: "↗",
    color: "blue",
    traits: ["Focused", "Encouraging", "Practical"],
  },
] as const;

type PersonaId = (typeof personas)[number]["id"];

type RecognitionAlternativeLike = {
  transcript: string;
};

type RecognitionResultLike = {
  isFinal: boolean;
  0: RecognitionAlternativeLike;
};

type RecognitionEventLike = {
  results: ArrayLike<RecognitionResultLike>;
};

type RecognitionErrorLike = {
  error: string;
};

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructorLike = new () => RecognitionLike;

type Message = {
  id: string;
  role: MessageRole;
  text: string;
  time: string;
};

const starters = [
  {
    icon: "☁",
    title: "Clear my mind",
    prompt: "I've got a lot on my mind. Help me sort through it.",
    tone: "lavender",
  },
  {
    icon: "✧",
    title: "Find motivation",
    prompt: "Help me find the motivation to make progress today.",
    tone: "peach",
  },
  {
    icon: "◌",
    title: "Talk about life",
    prompt: "Let's have a thoughtful conversation about life.",
    tone: "blue",
  },
  {
    icon: "⌘",
    title: "Explore an idea",
    prompt: "I have an idea I want to explore with you.",
    tone: "green",
  },
];

function formatTime(timestamp = Date.now()): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function expressionForReply(
  text: string,
  persona: PersonaId
): EchoAvatarExpression {
  const reply = text.toLowerCase();

  if (
    /\b(sorry|difficult|stress|sad|hurt|worried|anxious|that sounds hard|i understand)\b/.test(
      reply
    )
  ) {
    return "concerned";
  }

  if (
    /\b(great|congratulations|awesome|wonderful|proud of you|exciting|love that|well done)\b/.test(
      reply
    )
  ) {
    return "warm";
  }

  if (
    /\b(curious|wonder|what if|interesting|let's explore|let us explore)\b/.test(
      reply
    )
  ) {
    return "curious";
  }

  if (persona === "atlas") return "focused";
  if (persona === "nova") return "warm";

  return "neutral";
}

function App() {
  const [selectedPersonaId, setSelectedPersonaId] =
    useState<PersonaId>("sage");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] =
    useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState("");
  const [activeNav, setActiveNav] = useState("chat");

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(true);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [speakingMessageId, setSpeakingMessageId] =
    useState<string | null>(null);
  const [avatarExpression, setAvatarExpression] =
    useState<EchoAvatarExpression>("neutral");

  const conversationVersion = useRef(0);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const voiceSessionRef = useRef(false);
  const speechVersionRef = useRef(0);
  const mouthIntervalRef = useRef<number | null>(null);
  const restartListeningTimerRef = useRef<number | null>(null);
  const mouthPulseRef = useRef(0.55);

  const selectedPersona =
    personas.find((persona) => persona.id === selectedPersonaId) ??
    personas[0];

  const avatarState: EchoAvatarState = isSpeaking
    ? "speaking"
    : isListening
      ? "listening"
      : isThinking
        ? "thinking"
        : "idle";

  // Load saved conversations.
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const saved = await listConversations();

        if (!cancelled) {
          setConversations(saved);
        }
      } catch {
        if (!cancelled) {
          setChatError(
            "Couldn't load your saved conversations. Check your Firebase configuration and Firestore rules."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  // Clean up microphone, timers, and audio when the app unmounts.
  useEffect(() => {
    return () => {
      voiceSessionRef.current = false;
      recognitionRef.current?.abort();

      if (mouthIntervalRef.current !== null) {
        window.clearInterval(mouthIntervalRef.current);
      }

      if (restartListeningTimerRef.current !== null) {
        window.clearTimeout(restartListeningTimerRef.current);
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopSpeechPlayback() {
    speechVersionRef.current += 1;

    if (mouthIntervalRef.current !== null) {
      window.clearInterval(mouthIntervalRef.current);
      mouthIntervalRef.current = null;
    }

    if (restartListeningTimerRef.current !== null) {
      window.clearTimeout(restartListeningTimerRef.current);
      restartListeningTimerRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setMouthOpen(0);
  }

  function stopVoiceSession() {
    voiceSessionRef.current = false;
    setVoiceSessionActive(false);

    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    }

    setIsListening(false);
    stopSpeechPlayback();
  }

  // Start one microphone listening turn.
  function startListening() {
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructorLike;
      webkitSpeechRecognition?: RecognitionConstructorLike;
    };

    const Recognition =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      voiceSessionRef.current = false;
      setVoiceSessionActive(false);
      setIsListening(false);
      setChatError(
        "Voice input isn't available in this browser. Try the latest Chrome or Edge."
      );
      return;
    }

    stopSpeechPlayback();
    setChatError("");

    try {
      const recognition = new Recognition();
      let finalTranscriptReceived = false;

      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();

        if (transcript && !finalTranscriptReceived) {
          finalTranscriptReceived = true;
          setDraft(transcript);
          setIsListening(false);
          void submitMessage(transcript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);

        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          voiceSessionRef.current = false;
          setVoiceSessionActive(false);
          setChatError(
            "Microphone permission was blocked. Allow microphone access in your browser and try again."
          );
        } else if (
          event.error !== "no-speech" &&
          event.error !== "aborted"
        ) {
          setChatError(
            "Echo couldn't hear that clearly. Please try again."
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);

        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }

        // Resume listening after silence if this is an active voice session.
        if (voiceSessionRef.current && !finalTranscriptReceived) {
          if (restartListeningTimerRef.current !== null) {
            window.clearTimeout(restartListeningTimerRef.current);
          }

          restartListeningTimerRef.current = window.setTimeout(() => {
            restartListeningTimerRef.current = null;

            if (voiceSessionRef.current) {
              startListening();
            }
          }, 900);
        }
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      voiceSessionRef.current = false;
      setVoiceSessionActive(false);
      setChatError(
        "The microphone couldn't start. Check its browser permission and try again."
      );
    }
  }

  function toggleVoiceSession() {
    if (voiceSessionRef.current) {
      stopVoiceSession();
      return;
    }

    voiceSessionRef.current = true;
    setVoiceSessionActive(true);
    setVoiceRepliesEnabled(true);
    startListening();
  }

  function toggleVoiceReplies() {
    const next = !voiceRepliesEnabled;
    setVoiceRepliesEnabled(next);

    if (!next) {
      stopVoiceSession();
    }
  }

  // Speak an assistant response and drive the avatar's mouth from audio timing.
  function speakReply(
    text: string,
    persona: PersonaId,
    messageId: string
  ) {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setChatError(
        "Spoken replies aren't supported in this browser. Your text reply is still available."
      );
      return;
    }

    const version = ++speechVersionRef.current;

    if (mouthIntervalRef.current !== null) {
      window.clearInterval(mouthIntervalRef.current);
      mouthIntervalRef.current = null;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";
    utterance.rate =
      persona === "nova" ? 1.02 : persona === "sage" ? 0.92 : 0.97;
    utterance.pitch =
      persona === "nova" ? 1.08 : persona === "sage" ? 0.9 : 0.96;

    const voices = window.speechSynthesis.getVoices();

    const preferredVoice =
      voices.find(
        (voice) => voice.lang.toLowerCase() === "en-in"
      ) ??
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith("en-")
      );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      if (speechVersionRef.current !== version) return;

      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
      mouthPulseRef.current = 0.55;
      setMouthOpen(0.55);

      mouthIntervalRef.current = window.setInterval(() => {
        const pulse =
          0.2 + Math.abs(Math.sin(Date.now() / 57)) * 0.8;

        setMouthOpen(
          Math.min(1, Math.max(0.08, mouthPulseRef.current * pulse))
        );
      }, 75);
    };

    utterance.onboundary = (event) => {
      if (speechVersionRef.current !== version) return;

      const currentWord =
        text.slice(event.charIndex).match(/^[^\s,.;!?]+/)?.[0] ?? "";

      const vowelCount =
        (currentWord.match(/[aeiouy]/gi) ?? []).length;

      mouthPulseRef.current = Math.max(
        0.28,
        Math.min(
          1,
          0.22 + vowelCount / Math.max(1, currentWord.length)
        )
      );

      setMouthOpen(mouthPulseRef.current);
    };

    const finishSpeaking = () => {
      if (mouthIntervalRef.current !== null) {
        window.clearInterval(mouthIntervalRef.current);
        mouthIntervalRef.current = null;
      }

      if (speechVersionRef.current !== version) return;

      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setMouthOpen(0);

      // In conversation mode, listen for the next turn.
      if (voiceSessionRef.current) {
        restartListeningTimerRef.current = window.setTimeout(() => {
          restartListeningTimerRef.current = null;

          if (voiceSessionRef.current) {
            startListening();
          }
        }, 400);
      }
    };

    utterance.onend = finishSpeaking;

    utterance.onerror = (event) => {
      finishSpeaking();

      const error = (event as SpeechSynthesisErrorEvent).error;

      if (error !== "canceled" && error !== "interrupted") {
        setChatError(
          "Audio playback stopped unexpectedly. You can still read Echo's reply."
        );
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function selectPersona(personaId: PersonaId) {
    stopSpeechPlayback();
    setSelectedPersonaId(personaId);
    setChatError("");

    setAvatarExpression(
      personaId === "nova"
        ? "curious"
        : personaId === "atlas"
          ? "focused"
          : "neutral"
    );
  }

  function startNewChat() {
    stopVoiceSession();

    conversationVersion.current += 1;
    setActiveConversationId(null);
    setMessages([]);
    setDraft("");
    setIsThinking(false);
    setChatError("");
    setActiveNav("chat");
  }

  async function openConversation(
    conversation: SavedConversation
  ) {
    stopVoiceSession();

    conversationVersion.current += 1;
    const version = conversationVersion.current;

    setActiveConversationId(conversation.id);
    setSelectedPersonaId(conversation.persona);
    setMessages([]);
    setDraft("");
    setIsThinking(false);
    setChatError("");
    setActiveNav("chat");

    try {
      const savedMessages = await loadConversationMessages(
        conversation.id
      );

      if (conversationVersion.current !== version) {
        return;
      }

      setMessages(
        savedMessages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.content,
          time: formatTime(message.createdAt),
        }))
      );
    } catch (error) {
      if (conversationVersion.current === version) {
        setChatError(
          error instanceof Error
            ? error.message
            : "Couldn't load this conversation."
        );
      }
    }
  }

  function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    void submitMessage();
  }

  async function submitMessage(textOverride?: string) {
    const text = (textOverride ?? draft).trim();

    if (!text || isThinking) {
      return;
    }

    const version = conversationVersion.current;
    const personaForRequest = selectedPersonaId;

    const history = messages.slice(-12).map((message) => ({
      role: message.role,
      content: message.text,
    }));

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
      time: formatTime(),
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");

    setAvatarExpression(
      personaForRequest === "nova"
        ? "curious"
        : personaForRequest === "atlas"
          ? "focused"
          : "neutral"
    );

    setIsThinking(true);
    setChatError("");
    setActiveNav("chat");

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        conversationId = await createConversation(
          text,
          personaForRequest
        );

        if (conversationVersion.current !== version) {
          return;
        }

        setActiveConversationId(conversationId);

        const now = Date.now();

        const newConversation: SavedConversation = {
          id: conversationId,
          title: text.slice(0, 100) || "New conversation",
          persona: personaForRequest as StoredPersonaId,
          createdAt: now,
          updatedAt: now,
        };

        setConversations((current) => [
          newConversation,
          ...current.filter(
            (item) => item.id !== conversationId
          ),
        ]);
      }

      await saveConversationMessage(
        conversationId,
        "user",
        text
      );

      if (conversationVersion.current !== version) {
        return;
      }

      const savedAt = Date.now();

      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? { ...item, updatedAt: savedAt }
            : item
        )
      );

      const replyText = await sendChatMessage({
        message: text,
        persona: personaForRequest,
        history,
      });

      if (conversationVersion.current !== version) {
        return;
      }

      const reply: Message = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: replyText,
        time: formatTime(),
      };

      setMessages((current) => [...current, reply]);

      setAvatarExpression(
        expressionForReply(replyText, personaForRequest)
      );

      if (voiceRepliesEnabled || voiceSessionRef.current) {
        speakReply(replyText, personaForRequest, reply.id);
      }

      await saveConversationMessage(
        conversationId,
        "assistant",
        replyText
      );

      if (conversationVersion.current !== version) {
        return;
      }

      const updatedAt = Date.now();

      setConversations((current) =>
        current
          .map((item) =>
            item.id === conversationId
              ? { ...item, updatedAt }
              : item
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    } catch (error) {
      if (conversationVersion.current !== version) {
        return;
      }

      setChatError(
        error instanceof Error
          ? error.message
          : "Echo couldn't complete your message. Please try again."
      );
    } finally {
      if (conversationVersion.current === version) {
        setIsThinking(false);
      }
    }
  }

  function handleComposerKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function chooseStarter(prompt: string) {
    setDraft(prompt);
    setChatError("");
  }

  return (
    <div className={`echo-app echo-theme-${selectedPersonaId}`}>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={startNewChat}
          type="button"
          aria-label="Echo home and new conversation"
        >
          <span className="brand-mark">✦</span>
          <span className="brand-wordmark">
            echo<span>.</span>
          </span>
        </button>

        <div className="sidebar-caption">YOUR SPACE</div>

        <button
          className="new-chat-button sidebar-new-chat"
          onClick={startNewChat}
          type="button"
        >
          <span>＋</span> New conversation
        </button>

        <nav className="side-nav" aria-label="Main navigation">
          <button
            className={`nav-link ${
              activeNav === "chat" ? "nav-link-active" : ""
            }`}
            onClick={() => setActiveNav("chat")}
            type="button"
          >
            <span className="nav-icon">◫</span>
            <span>Conversations</span>
            <span className="nav-count">
              {conversations.length}
            </span>
          </button>

          <button
            className={`nav-link ${
              activeNav === "discover" ? "nav-link-active" : ""
            }`}
            onClick={() => setActiveNav("discover")}
            type="button"
          >
            <span className="nav-icon">✧</span>
            <span>Discover</span>
            <span className="soon-label">Soon</span>
          </button>

          <button
            className={`nav-link ${
              activeNav === "memory" ? "nav-link-active" : ""
            }`}
            onClick={() => setActiveNav("memory")}
            type="button"
          >
            <span className="nav-icon">♡</span>
            <span>My memories</span>
            <span className="soon-label">Soon</span>
          </button>

          <button
            className="nav-link"
            onClick={() => setActiveNav("projects")}
            type="button"
          >
            <span className="nav-icon">▱</span>
            <span>Projects</span>
            <span className="soon-label">Soon</span>
          </button>

          <button
            className="nav-link"
            onClick={() => setActiveNav("home")}
            type="button"
          >
            <span className="nav-icon">⌂</span>
            <span>Home</span>
            <span className="soon-label">Soon</span>
          </button>

          <button
            className="nav-link"
            onClick={() => setActiveNav("labs")}
            type="button"
          >
            <span className="nav-icon">⚗</span>
            <span>Labs</span>
            <span className="soon-label">Soon</span>
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section-title">
          <span>RECENT CONVERSATIONS</span>
          <span className="muted-number">
            {conversations.length}
          </span>
        </div>

        <div className="recent-conversations-list">
          {isLoadingHistory ? (
            <div className="recent-empty">
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length > 0 ? (
            conversations.slice(0, 12).map((conversation) => (
              <button
                className={`recent-conversation ${
                  activeConversationId === conversation.id
                    ? "recent-conversation-active"
                    : ""
                }`}
                type="button"
                key={conversation.id}
                onClick={() => void openConversation(conversation)}
                aria-current={
                  activeConversationId === conversation.id
                    ? "page"
                    : undefined
                }
              >
                <span className="recent-indicator" />

                <span className="recent-copy">
                  <strong>{conversation.title}</strong>
                  <small>
                    {personas.find(
                      (persona) =>
                        persona.id === conversation.persona
                    )?.name ?? "Sage"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <div className="recent-empty">
              <span className="recent-empty-icon">◷</span>
              <p>Your conversations will appear here.</p>
            </div>
          )}
        </div>

        <div className="sidebar-spacer" />

        <div className="privacy-card">
          <span className="privacy-icon">◈</span>
          <div>
            <strong>Your space, your rules</strong>
            <p>
              Conversations are saved to your signed-in account.
              Memory controls are coming next.
            </p>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">Y</div>
          <div className="profile-copy">
            <strong>Your space</strong>
            <span>Signed-in session</span>
          </div>
          <span className="profile-menu">···</span>
        </div>
      </aside>

      <main className="main-layout">
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb">
              <span>Echo</span>
              <span className="breadcrumb-slash">/</span>
              <strong>Companion</strong>
            </div>

            <div className="preview-pill">
              <span className="preview-dot" />
              AI COMPANION
            </div>
          </div>

          <div className="topbar-actions">
            <span className="current-persona">
              <span
                className={`mini-persona-avatar ${selectedPersona.color}`}
              >
                {selectedPersona.avatar}
              </span>

              <span>{selectedPersona.name}</span>
              <span className="chevron">⌄</span>
            </span>

            <button
              className="topbar-icon-button"
              type="button"
              title="New conversation"
              aria-label="New conversation"
              onClick={startNewChat}
            >
              ↗
            </button>
          </div>
        </header>

        <div className="preview-banner">
          <span className="banner-sparkle">✦</span>

          <div>
            <strong>Your personal AI companion</strong>
            <span>
              Talk with Sage, Nova, or Atlas. Your conversations
              are saved to your account.
            </span>
          </div>

          <span className="banner-status">AI MODE</span>
        </div>

        <div className="content-grid">
          <section className="chat-column">
            {messages.length === 0 ? (
              <div
                className={`chat-welcome welcome-persona-${selectedPersonaId}`}
              >
                <div
                  className={`welcome-scene welcome-scene-${selectedPersonaId}`}
                >
                  <div
                    className="welcome-scene-backdrop"
                    aria-hidden="true"
                  >
                    <span className="welcome-scene-ring welcome-scene-ring-one" />
                    <span className="welcome-scene-ring welcome-scene-ring-two" />
                    <span className="welcome-scene-ring welcome-scene-ring-three" />

                    {selectedPersonaId === "sage" && (
                      <>
                        <span className="welcome-scene-symbol symbol-left">✿</span>
                        <span className="welcome-scene-symbol symbol-right">✿</span>
                        <span className="welcome-scene-particle particle-left">✧</span>
                        <span className="welcome-scene-particle particle-right">✦</span>
                      </>
                    )}

                    {selectedPersonaId === "nova" && (
                      <>
                        <span className="welcome-scene-symbol symbol-left">✷</span>
                        <span className="welcome-scene-symbol symbol-right">✧</span>
                        <span className="welcome-scene-particle particle-left">✦</span>
                        <span className="welcome-scene-particle particle-right">✷</span>
                      </>
                    )}

                    {selectedPersonaId === "atlas" && (
                      <>
                        <span className="welcome-scene-symbol symbol-left">⌁</span>
                        <span className="welcome-scene-symbol symbol-right">↗</span>
                        <span className="welcome-scene-particle particle-left">✧</span>
                        <span className="welcome-scene-particle particle-right">✦</span>
                      </>
                    )}
                  </div>

                  <div className="welcome-scene-character">
                    <EchoAvatar
                      state={avatarState}
                      size="hero"
                      persona={selectedPersonaId}
                      expression={avatarExpression}
                      mouthOpen={mouthOpen}
                      label={`Echo ${selectedPersona.name} character`}
                    />
                  </div>
                </div>

                <div className="welcome-kicker">
                  A LITTLE SPACE JUST FOR YOU
                </div>

                <h1>
                  A thought on your mind?
                  <br />
                  <span>Let’s start there.</span>
                </h1>

                <p className="welcome-description">
                  No scripts. No pressure. Just a space to think,
                  talk, explore, and be yourself.
                </p>

                <div className="prompt-heading">
                  <span>START WITH A THOUGHT</span>
                  <span className="prompt-heading-line" />
                </div>

                <div className="prompt-grid">
                  {starters.map((starter) => (
                    <button
                      className={`prompt-card prompt-${starter.tone}`}
                      key={starter.title}
                      onClick={() => chooseStarter(starter.prompt)}
                      type="button"
                    >
                      <span className="prompt-card-icon">
                        {starter.icon}
                      </span>

                      <span className="prompt-card-copy">
                        <strong>{starter.title}</strong>
                        <small>{starter.prompt}</small>
                      </span>

                      <span className="prompt-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="conversation-view">
                <div className="conversation-heading">
                  <span
                    className={`mini-persona-avatar ${selectedPersona.color}`}
                  >
                    <EchoAvatar
                      state={avatarState}
                      size="chat"
                      persona={selectedPersonaId}
                      expression={avatarExpression}
                      mouthOpen={mouthOpen}
                      label={`Echo ${selectedPersona.name}`}
                    />
                  </span>

                  <div>
                    <strong>
                      You and Echo · {selectedPersona.name}
                    </strong>
                    <span>Saved AI conversation</span>
                  </div>
                </div>

                <div className="message-list" aria-live="polite">
                  {messages.map((message) => (
                    <article
                      className={`message-row ${
                        message.role === "user"
                          ? "message-row-user"
                          : ""
                      }`}
                      key={message.id}
                    >
                      {message.role === "assistant" && (
                        <div
                          className={`message-avatar ${selectedPersona.color} message-avatar-character`}
                        >
                          <EchoAvatar
                            state={
                              isSpeaking &&
                              speakingMessageId === message.id
                                ? "speaking"
                                : "idle"
                            }
                            size="chat"
                            persona={selectedPersonaId}
                            expression={avatarExpression}
                            mouthOpen={
                              isSpeaking &&
                              speakingMessageId === message.id
                                ? mouthOpen
                                : 0
                            }
                            label={`Echo ${selectedPersona.name}`}
                          />
                        </div>
                      )}

                      <div className="message-content">
                        <div className="message-meta">
                          <strong>
                            {message.role === "user"
                              ? "You"
                              : `Echo · ${selectedPersona.name}`}
                          </strong>

                          <span>{message.time}</span>
                        </div>

                        <div className="message-bubble">
                          {message.text}
                        </div>
                      </div>

                      {message.role === "user" && (
                        <div className="message-user-avatar">Y</div>
                      )}
                    </article>
                  ))}

                  {chatError && (
                    <p
                      role="alert"
                      style={{
                        color: "#ffb3c0",
                        fontSize: "12px",
                        lineHeight: 1.6,
                        padding: "8px 12px",
                      }}
                    >
                      {chatError}
                    </p>
                  )}

                  {isThinking && (
                    <div className="message-row">
                      <div
                        className={`message-avatar ${selectedPersona.color} message-avatar-character`}
                      >
                        <EchoAvatar
                          state="thinking"
                          size="chat"
                          persona={selectedPersonaId}
                          expression={avatarExpression}
                          label={`Echo ${selectedPersona.name} is thinking`}
                        />
                      </div>

                      <div className="message-content">
                        <div className="message-meta">
                          <strong>
                            Echo · {selectedPersona.name}
                          </strong>
                          <span>Thinking</span>
                        </div>

                        <div
                          className="typing-bubble"
                          aria-label="Echo is thinking"
                          role="status"
                        >
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="composer-wrap">
              <form className="composer" onSubmit={sendMessage}>
                <span className="composer-plus">＋</span>

                <button
                  className={`composer-audio-toggle ${
                    voiceRepliesEnabled
                      ? "composer-audio-toggle-active"
                      : ""
                  }`}
                  type="button"
                  onClick={toggleVoiceReplies}
                  aria-label={
                    voiceRepliesEnabled
                      ? "Turn spoken replies off"
                      : "Turn spoken replies on"
                  }
                  aria-pressed={voiceRepliesEnabled}
                  title={
                    voiceRepliesEnabled
                      ? "Spoken replies are on"
                      : "Turn spoken replies on"
                  }
                >
                  ♫
                </button>

                <input
                  aria-label="Message Echo"
                  className="composer-input"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={`Share what's on your mind with Echo · ${selectedPersona.name}...`}
                  disabled={isThinking}
                  maxLength={4000}
                />

                <button
                  className={`composer-mic ${
                    voiceSessionActive ? "composer-mic-active" : ""
                  }`}
                  type="button"
                  onClick={toggleVoiceSession}
                  aria-label={
                    voiceSessionActive
                      ? "End voice conversation"
                      : "Start voice conversation"
                  }
                  aria-pressed={voiceSessionActive}
                  title={
                    voiceSessionActive
                      ? "End voice conversation"
                      : "Start voice conversation"
                  }
                  disabled={isThinking && !voiceSessionActive}
                >
                  {isListening ? "●" : "🎙"}
                </button>

                <button
                  className="composer-send"
                  disabled={!draft.trim() || isThinking}
                  type="submit"
                  aria-label="Send message"
                  title="Send message"
                >
                  ↑
                </button>
              </form>

              <div className="composer-footnote" aria-live="polite">
                <span>
                  {isListening
                    ? "Listening… speak naturally"
                    : isSpeaking
                      ? `Echo · ${selectedPersona.name} is speaking`
                      : voiceSessionActive
                        ? "Voice conversation active"
                        : voiceRepliesEnabled
                          ? "Voice replies on"
                          : "Voice replies off"}
                </span>

                <span className="footnote-divider">·</span>

                <span>
                  Messages are saved to your signed-in account.
                </span>
              </div>
            </div>
          </section>

          <aside className="companion-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">YOUR COMPANION</span>
                <h2>Meet Echo.</h2>
              </div>

              <span className="panel-star">✧</span>
            </div>

            <div
              className={`companion-feature companion-${selectedPersona.color} companion-persona-${selectedPersonaId}`}
            >
              <div className="feature-orbit feature-orbit-one" />
              <div className="feature-orbit feature-orbit-two" />

              <div className="feature-avatar">
                <EchoAvatar
                  state={avatarState}
                  size="hero"
                  persona={selectedPersonaId}
                  expression={avatarExpression}
                  mouthOpen={mouthOpen}
                  label={`Echo ${selectedPersona.name}`}
                />
              </div>

              <div className="feature-copy">
                <span className="feature-label">
                  YOUR PERSONAL ASSISTANT
                </span>

                <h3>
                  Echo <span className="feature-name-separator">·</span>{" "}
                  <span className="feature-persona-name">
                    {selectedPersona.name}
                  </span>
                </h3>

                <p>{selectedPersona.role}</p>

                <p className="feature-creator">
                  Designed by Antariksh Tyagi
                </p>
              </div>

              <span className="feature-status">
                <span />
                {isSpeaking
                  ? "Speaking"
                  : isListening
                    ? "Listening"
                    : isThinking
                      ? "Thinking"
                      : "Ready"}
              </span>
            </div>

            <div className="persona-list-heading">
              <span>CHOOSE A PERSONALITY</span>
              <span>03</span>
            </div>

            <div className="persona-list">
              {personas.map((persona) => (
                <button
                  className={`persona-option persona-option-${persona.id} ${
                    selectedPersonaId === persona.id
                      ? "persona-selected"
                      : ""
                  }`}
                  key={persona.id}
                  onClick={() => selectPersona(persona.id)}
                  type="button"
                  aria-pressed={selectedPersonaId === persona.id}
                >
                  <span
                    className={`persona-avatar persona-avatar-character ${persona.color}`}
                  >
                    <EchoAvatar
                      state="idle"
                      size="chat"
                      persona={persona.id}
                      label={`${persona.name} character`}
                    />
                  </span>

                  <span className="persona-info">
                    <strong>{persona.name}</strong>
                    <small>{persona.role}</small>

                    <span className="persona-traits">
                      {persona.traits.map((trait) => (
                        <span key={trait}>{trait}</span>
                      ))}
                    </span>
                  </span>

                  <span className="persona-check">
                    {selectedPersonaId === persona.id ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="personality-details">
              <span className="personality-details-heading">
                A LITTLE ABOUT {selectedPersona.name.toUpperCase()}
              </span>

              <p>{selectedPersona.description}</p>
            </div>

            <div className="memory-card">
              <div className="memory-card-icon">⌘</div>

              <div className="memory-card-copy">
                <strong>Memory, your way</strong>

                <p>
                  Choose what Echo remembers and delete it whenever you like.
                </p>

                <span>PERSONAL MEMORY IS COMING NEXT</span>
              </div>
            </div>

            <div className="panel-footer">
              <span className="panel-footer-spark">✦</span>
              Your space. Your pace. Your Echo.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
