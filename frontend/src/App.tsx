
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";

import EchoAvatar, {
  type EchoAvatarExpression,
  type EchoAvatarState,
} from "./EchoAvatar";
import Sage3DCharacter from "./Sage3DCharacter";
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

/**
 * All three saved character artworks are displayed together.
 * Selecting one switches the conversation persona.
 */
function WelcomeTrioScene({
  selectedPersonaId,
  onSelectPersona,
}: {
  selectedPersonaId: PersonaId;
  onSelectPersona: (id: PersonaId) => void;
}) {
  const styles: Record<string, CSSProperties> = {
    scene: {
      position: "relative",
      isolation: "isolate",
      display: "grid",
      width: "100%",
      maxWidth: 980,
      height: "clamp(290px, 38vh, 430px)",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      alignItems: "stretch",
      gap: "clamp(8px, 1.3vw, 18px)",
      padding: "clamp(10px, 1.5vw, 18px)",
      margin: "0 auto 12px",
      overflow: "hidden",
      border: "1px solid rgba(183, 149, 255, 0.2)",
      borderRadius: 22,
      background:
        "radial-gradient(ellipse at 17% 55%, rgba(129,76,230,.24), transparent 42%), radial-gradient(ellipse at 83% 55%, rgba(64,139,255,.19), transparent 42%), radial-gradient(ellipse at 50% 52%, rgba(255,142,77,.13), transparent 42%), linear-gradient(145deg,#171023,#090711 74%)",
    },
    atmosphere: {
      position: "absolute",
      inset: 0,
      zIndex: -1,
      overflow: "hidden",
      pointerEvents: "none",
    },
    orbitOne: {
      position: "absolute",
      left: "50%",
      top: "51%",
      width: "min(58%, 510px)",
      aspectRatio: "1",
      border: "1px solid rgba(175,145,255,.16)",
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
    },
    orbitTwo: {
      position: "absolute",
      left: "50%",
      top: "51%",
      width: "min(42%, 370px)",
      aspectRatio: "1",
      border: "1px dashed rgba(175,145,255,.19)",
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
    },
    character: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      minWidth: 0,
      minHeight: 0,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "10px 7px 12px",
      overflow: "hidden",
      border: "1px solid rgba(205,183,255,.15)",
      borderRadius: 16,
      color: "#f4efff",
      background:
        "linear-gradient(180deg, rgba(255,255,255,.035), rgba(12,8,22,.78))",
      cursor: "pointer",
      transition:
        "border-color 220ms ease, background 220ms ease, transform 220ms ease, box-shadow 220ms ease",
    },
    art: {
      display: "flex",
      width: "100%",
      minWidth: 0,
      minHeight: 0,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    image: {
      display: "block",
      width: "100%",
      height: "100%",
      minHeight: 0,
      objectFit: "contain",
      objectPosition: "center bottom",
      filter: "drop-shadow(0 0 18px rgba(171,132,255,.2))",
    },
    name: {
      marginTop: 5,
      fontSize: "clamp(13px, 1.35vw, 19px)",
      fontWeight: 750,
      letterSpacing: "-0.3px",
    },
    role: {
      marginTop: 4,
      color: "#b7accb",
      fontSize: "clamp(8px, .8vw, 11px)",
      textAlign: "center",
    },
    status: {
      marginTop: 9,
      color: "#b9a0ff",
      fontSize: 8,
      fontWeight: 750,
      letterSpacing: 1.2,
      opacity: 0.9,
    },
  };

  return (
    <div
      className={`welcome-trio-scene welcome-trio-selected-${selectedPersonaId}`}
      style={styles.scene}
    >
      <style>{`
        @keyframes echo-welcome-glow {
          0%, 100% { opacity: .28; transform: scale(.94); }
          50% { opacity: .48; transform: scale(1.08); }
        }
        .welcome-trio-character:hover {
          transform: translateY(-4px);
        }
        .welcome-trio-character img {
          transition: transform 260ms ease, filter 260ms ease;
        }
        .welcome-trio-character:hover img {
          transform: scale(1.045);
        }
        .welcome-trio-character:focus-visible {
          outline: 2px solid #c5a5ff;
          outline-offset: 2px;
        }
        @media (max-width: 650px) {
          .welcome-trio-scene {
            height: 275px !important;
            gap: 6px !important;
            padding: 8px !important;
            border-radius: 16px !important;
          }
          .welcome-trio-character {
            padding: 7px 4px 9px !important;
            border-radius: 12px !important;
          }
          .welcome-trio-character .welcome-trio-name {
            font-size: 12px !important;
          }
          .welcome-trio-character .welcome-trio-role {
            font-size: 8px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-trio-character,
          .welcome-trio-character img {
            transition: none !important;
          }
        }
      `}</style>

      <div style={styles.atmosphere} aria-hidden="true">
        <span style={styles.orbitOne} />
        <span style={styles.orbitTwo} />

        {[
          { left: "4%", top: "12%", color: "#8b4dff" },
          { left: "39%", top: "16%", color: "#ff8b50" },
          { right: "3%", top: "15%", color: "#3199ff" },
        ].map((glow, index) => (
          <span
            key={index}
            style={{
              position: "absolute",
              width: "28%",
              aspectRatio: "1",
              borderRadius: "50%",
              filter: "blur(44px)",
              opacity: 0.36,
              background: glow.color,
              left: "left" in glow ? glow.left : undefined,
              right: "right" in glow ? glow.right : undefined,
              top: glow.top,
              animation: `echo-welcome-glow 5s ease-in-out ${index * 0.8}s infinite`,
            }}
          />
        ))}
      </div>

      {personas.map((persona) => {
        const selected = selectedPersonaId === persona.id;

        const personaTint =
          persona.id === "nova"
            ? "rgba(255,147,82,.25)"
            : persona.id === "atlas"
              ? "rgba(69,161,255,.24)"
              : "rgba(171,132,255,.25)";

        return (
          <button
            key={persona.id}
            type="button"
            className={`welcome-trio-character welcome-trio-${persona.id} ${
              selected ? "is-selected" : ""
            }`}
            style={{
              ...styles.character,
              borderColor: selected
                ? "rgba(196,164,255,.82)"
                : "rgba(205,183,255,.15)",
              background: selected
                ? `linear-gradient(180deg, ${personaTint}, rgba(12,8,22,.82))`
                : "linear-gradient(180deg, rgba(255,255,255,.035), rgba(12,8,22,.78))",
              boxShadow: selected
                ? "0 0 26px rgba(148,100,255,.19), inset 0 0 20px rgba(148,100,255,.06)"
                : "none",
            }}
            onClick={() => onSelectPersona(persona.id)}
            aria-pressed={selected}
            aria-label={`Choose ${persona.name}`}
          >
            <span style={styles.art}>
              <img
                src={`/personas/${persona.id}.png`}
                alt=""
                loading="eager"
                style={{
                  ...styles.image,
                  filter:
                    persona.id === "nova"
                      ? "drop-shadow(0 0 18px rgba(255,148,83,.22))"
                      : persona.id === "atlas"
                        ? "drop-shadow(0 0 18px rgba(71,165,255,.22))"
                        : "drop-shadow(0 0 18px rgba(171,132,255,.22))",
                }}
              />
            </span>

            <span className="welcome-trio-name" style={styles.name}>
              {persona.name}
            </span>

            <span className="welcome-trio-role" style={styles.role}>
              {persona.role}
            </span>

            <span style={styles.status}>
              {selected ? "YOUR COMPANION" : "MEET ECHO"}
            </span>
          </button>
        );
      })}
    </div>
  );
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
            <span className="nav-count">{conversations.length}</span>
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
          <span className="muted-number">{conversations.length}</span>
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
                style={{
                  width: "100%",
                  maxWidth: 1020,
                  alignSelf: "center",
                }}
              >
                <WelcomeTrioScene
                  selectedPersonaId={selectedPersonaId}
                  onSelectPersona={selectPersona}
                />

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

              <div
                className="feature-avatar selected-persona-art"
                style={{
                  width: 155,
                  height: 190,
                  top: 10,
                  right: 12,
                  border: 0,
                  borderRadius: 12,
                  background: "transparent",
                  boxShadow: "none",
                }}
              >
                {selectedPersonaId === "sage" ? (
                  <Sage3DCharacter state={avatarState} compact />
                ) : (
                  <img
                    className="selected-persona-portrait"
                    src={`/personas/${selectedPersonaId}.png`}
                    alt={`Echo ${selectedPersona.name}`}
                    loading="eager"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      objectPosition: "center top",
                      borderRadius: 12,
                    }}
                  />
                )}
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
