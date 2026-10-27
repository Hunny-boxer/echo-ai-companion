import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

const personas = [
  {
    id: "sage",
    name: "Sage",
    role: "Calm & thoughtful",
    description: "A gentle presence for reflection and meaningful conversations.",
    avatar: "✦",
    color: "lilac",
    traits: ["Thoughtful", "Patient", "Grounded"],
  },
  {
    id: "nova",
    name: "Nova",
    role: "Playful & curious",
    description: "A bright, curious companion for ideas, stories, and everyday fun.",
    avatar: "✷",
    color: "peach",
    traits: ["Curious", "Playful", "Creative"],
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Motivating & grounded",
    description: "A supportive coach to help you focus and take the next step.",
    avatar: "↗",
    color: "blue",
    traits: ["Focused", "Encouraging", "Practical"],
  },
] as const;

type PersonaId = (typeof personas)[number]["id"];
type MessageRole = "user" | "assistant";

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

function getPreviewReply(personaName: string): string {
  return `You've started a conversation with ${personaName}. This is a local preview response, not a live AI answer yet. In the next milestone, we'll connect Echo to its AI backend so it can respond meaningfully to your messages.`;
}

function App() {
  const [selectedPersonaId, setSelectedPersonaId] =
    useState<PersonaId>("sage");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeNav, setActiveNav] = useState("chat");
  const conversationVersion = useRef(0);

  const selectedPersona =
    personas.find((persona) => persona.id === selectedPersonaId) ??
    personas[0];

  function startNewChat() {
    conversationVersion.current += 1;
    setMessages([]);
    setDraft("");
    setIsThinking(false);
    setActiveNav("chat");
  }

  function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const text = draft.trim();
    if (!text || isThinking) return;

    const version = conversationVersion.current;
    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
      time: "Just now",
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsThinking(true);

    window.setTimeout(() => {
      if (conversationVersion.current !== version) return;

      const reply: Message = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: getPreviewReply(selectedPersona.name),
        time: "Just now",
      };

      setMessages((current) => [...current, reply]);
      setIsThinking(false);
    }, 450);
  }

  function handleComposerKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function chooseStarter(prompt: string) {
    setDraft(prompt);
  }

  return (
    <div className="echo-app">
      <aside className="sidebar">
        <button className="brand" onClick={startNewChat} type="button">
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
            className={`nav-link ${activeNav === "chat" ? "nav-link-active" : ""}`}
            onClick={() => setActiveNav("chat")}
            type="button"
          >
            <span className="nav-icon">◫</span>
            <span>Conversations</span>
            <span className="nav-count">{messages.length > 0 ? "1" : "0"}</span>
          </button>

          <button
            className={`nav-link ${activeNav === "discover" ? "nav-link-active" : ""}`}
            onClick={() => setActiveNav("discover")}
            type="button"
          >
            <span className="nav-icon">✧</span>
            <span>Discover</span>
            <span className="soon-label">Soon</span>
          </button>

          <button
            className={`nav-link ${activeNav === "memory" ? "nav-link-active" : ""}`}
            onClick={() => setActiveNav("memory")}
            type="button"
          >
            <span className="nav-icon">♡</span>
            <span>My memories</span>
            <span className="soon-label">Soon</span>
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section-title">
          <span>RECENT CONVERSATIONS</span>
          <span className="muted-number">{messages.length > 0 ? "1" : "0"}</span>
        </div>

        {messages.length > 0 ? (
          <button className="recent-conversation" type="button">
            <span className="recent-indicator" />
            <span className="recent-copy">
              <strong>{messages[0].text.slice(0, 26) || "New conversation"}</strong>
              <small>Just now</small>
            </span>
          </button>
        ) : (
          <div className="recent-empty">
            <span className="recent-empty-icon">◷</span>
            <p>Your conversations will appear here.</p>
          </div>
        )}

        <div className="sidebar-spacer" />

        <div className="privacy-card">
          <span className="privacy-icon">◈</span>
          <div>
            <strong>Your space, your rules</strong>
            <p>Memory controls are coming soon. This preview does not save chats.</p>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">Y</div>
          <div className="profile-copy">
            <strong>Your space</strong>
            <span>Guest preview</span>
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
              FRONTEND PREVIEW
            </div>
          </div>

          <div className="topbar-actions">
            <span className="current-persona">
              <span className={`mini-persona-avatar ${selectedPersona.color}`}>
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
            <strong>Welcome to Echo's first preview</strong>
            <span>
              Explore the interface and personalities. Real AI responses and
              account syncing are the next milestones.
            </span>
          </div>
          <span className="banner-status">LOCAL ONLY</span>
        </div>

        <div className="content-grid">
          <section className="chat-column">
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="welcome-orb">
                  <div className="orb-core">✦</div>
                  <span className="orb-ring orb-ring-one" />
                  <span className="orb-ring orb-ring-two" />
                  <span className="orb-spark orb-spark-one">✧</span>
                  <span className="orb-spark orb-spark-two">·</span>
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
                  No scripts. No pressure. Just a space to think, talk, explore,
                  and be yourself.
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
                      <span className="prompt-card-icon">{starter.icon}</span>
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
                  <span className={`mini-persona-avatar ${selectedPersona.color}`}>
                    {selectedPersona.avatar}
                  </span>
                  <div>
                    <strong>You and {selectedPersona.name}</strong>
                    <span>Local conversation preview</span>
                  </div>
                </div>

                <div className="message-list" aria-live="polite">
                  {messages.map((message) => (
                    <article
                      className={`message-row ${message.role === "user" ? "message-row-user" : ""}`}
                      key={message.id}
                    >
                      {message.role === "assistant" && (
                        <div className={`message-avatar ${selectedPersona.color}`}>
                          {selectedPersona.avatar}
                        </div>
                      )}
                      <div className="message-content">
                        <div className="message-meta">
                          <strong>
                            {message.role === "user"
                              ? "You"
                              : `${selectedPersona.name} · Preview`}
                          </strong>
                          <span>{message.time}</span>
                        </div>
                        <div className="message-bubble">{message.text}</div>
                      </div>
                      {message.role === "user" && (
                        <div className="message-user-avatar">Y</div>
                      )}
                    </article>
                  ))}

                  {isThinking && (
                    <div className="message-row">
                      <div className={`message-avatar ${selectedPersona.color}`}>
                        {selectedPersona.avatar}
                      </div>
                      <div className="message-content">
                        <div className="message-meta">
                          <strong>{selectedPersona.name} · Preview</strong>
                          <span>Thinking</span>
                        </div>
                        <div className="typing-bubble" aria-label="Loading preview">
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
                <input
                  aria-label="Message Echo"
                  className="composer-input"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={`Share what's on your mind with ${selectedPersona.name}...`}
                />
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
              <div className="composer-footnote">
                <span>↵ Enter to send</span>
                <span className="footnote-divider">·</span>
                <span>Preview messages aren't saved or sent to an AI service.</span>
              </div>
            </div>
          </section>

          <aside className="companion-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">YOUR COMPANION</span>
                <h2>Find your kind of energy.</h2>
              </div>
              <span className="panel-star">✧</span>
            </div>

            <div className={`companion-feature companion-${selectedPersona.color}`}>
              <div className="feature-orbit feature-orbit-one" />
              <div className="feature-orbit feature-orbit-two" />
              <div className="feature-avatar">{selectedPersona.avatar}</div>
              <div className="feature-copy">
                <span className="feature-label">YOUR COMPANION</span>
                <h3>{selectedPersona.name}</h3>
                <p>{selectedPersona.role}</p>
              </div>
              <span className="feature-status">
                <span /> Preview
              </span>
            </div>

            <div className="persona-list-heading">
              <span>CHOOSE A PERSONALITY</span>
              <span>03</span>
            </div>

            <div className="persona-list">
              {personas.map((persona) => (
                <button
                  className={`persona-option ${selectedPersonaId === persona.id ? "persona-selected" : ""}`}
                  key={persona.id}
                  onClick={() => setSelectedPersonaId(persona.id)}
                  type="button"
                  aria-pressed={selectedPersonaId === persona.id}
                >
                  <span className={`persona-avatar ${persona.color}`}>
                    {persona.avatar}
                  </span>
                  <span className="persona-info">
                    <strong>{persona.name}</strong>
                    <small>{persona.role}</small>
                  </span>
                  <span className="persona-check">
                    {selectedPersonaId === persona.id ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="personality-details">
              <span className="personality-details-heading">A LITTLE ABOUT {selectedPersona.name.toUpperCase()}</span>
              <p>{selectedPersona.description}</p>
              <div className="trait-list">
                {selectedPersona.traits.map((trait) => (
                  <span key={trait}>{trait}</span>
                ))}
              </div>
            </div>

            <div className="memory-card">
              <div className="memory-card-icon">⌘</div>
              <div className="memory-card-copy">
                <strong>Memory, your way</strong>
                <p>Choose what Echo remembers and delete it whenever you like.</p>
                <span>COMING IN A LATER MILESTONE</span>
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
