
import type { CSSProperties } from "react";
import "./echo-avatar.css";

export type EchoAvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

export type EchoPersona = "sage" | "nova" | "atlas";

export type EchoAvatarExpression =
  | "neutral"
  | "warm"
  | "curious"
  | "focused"
  | "concerned";

type EchoAvatarProps = {
  state?: EchoAvatarState;
  size?: "hero" | "panel" | "chat";
  persona?: EchoPersona;
  label?: string;
  expression?: EchoAvatarExpression;
  mouthOpen?: number;
};

const personaImages: Record<EchoPersona, string> = {
  sage: "/personas/sage.png",
  nova: "/personas/nova.png",
  atlas: "/personas/atlas.png",
};

export default function EchoAvatar({
  state = "idle",
  size = "panel",
  persona = "sage",
  label = "Echo AI assistant",
  expression = "neutral",
  mouthOpen = 0,
}: EchoAvatarProps) {
  const safeMouthOpen = Math.max(
    0,
    Math.min(1, Number.isFinite(mouthOpen) ? mouthOpen : 0)
  );

  const frameStyle: CSSProperties = {
    borderRadius: size === "chat" ? "10px" : "14px",
    background: "transparent",
    overflow: "hidden",
  };

  const portraitStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center 30%",
    userSelect: "none",
    pointerEvents: "none",
    filter:
      state === "speaking"
        ? `drop-shadow(0 0 13px var(--echo-avatar-glow)) brightness(${1 + safeMouthOpen * 0.12}) saturate(1.08)`
        : "drop-shadow(0 0 13px var(--echo-avatar-glow))",
  };

  const overlayStyle: CSSProperties = {
    zIndex: 2,
    pointerEvents: "none",
  };

  const ringStyle: CSSProperties = {
    zIndex: 3,
    pointerEvents: "none",
  };

  const statusStyle: CSSProperties = {
    zIndex: 4,
  };

  const statusText: Record<EchoAvatarState, string> = {
    idle: "Ready",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
  };

  return (
    <div
      className={[
        "echo-avatar",
        `echo-avatar-${size}`,
        `echo-avatar-persona-${persona}`,
        `echo-avatar-state-${state}`,
        `echo-avatar-expression-${expression}`,
      ].join(" ")}
      style={frameStyle}
      role="img"
      aria-label={`${label}, ${persona}, ${state}, ${expression} expression`}
    >
      <img
        className="echo-avatar-art echo-avatar-portrait"
        src={personaImages[persona]}
        alt=""
        draggable={false}
        style={portraitStyle}
      />

      <div
        className="echo-avatar-halo"
        style={overlayStyle}
        aria-hidden="true"
      />

      <div
        className="echo-avatar-ring echo-avatar-ring-one"
        style={ringStyle}
        aria-hidden="true"
      />

      <div
        className="echo-avatar-ring echo-avatar-ring-two"
        style={ringStyle}
        aria-hidden="true"
      />

      <div
        className="echo-avatar-ring echo-avatar-ring-three"
        style={ringStyle}
        aria-hidden="true"
      />

      <span
        className="echo-avatar-particle echo-avatar-particle-one"
        aria-hidden="true"
      />

      <span
        className="echo-avatar-particle echo-avatar-particle-two"
        aria-hidden="true"
      />

      <span
        className="echo-avatar-particle echo-avatar-particle-three"
        aria-hidden="true"
      />

      <div className="echo-avatar-status" style={statusStyle}>
        <span className="echo-avatar-status-dot" />
        {statusText[state]}
      </div>
    </div>
  );
}
