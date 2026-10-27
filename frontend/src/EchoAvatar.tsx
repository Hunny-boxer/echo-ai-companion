
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
    position: "relative",
    borderRadius: size === "chat" ? "10px" : "14px",
    background: "transparent",
    overflow: "hidden",
  };

  const portraitStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center 30%",
    userSelect: "none",
    pointerEvents: "none",
  };

  const faceLayerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 5,
    pointerEvents: "none",
  };

  const lidStyle: CSSProperties = {
    top: "calc(var(--echo-eye-top) + var(--echo-eye-y-adjust, 0%))",
    width: "var(--echo-eye-width)",
    height: "var(--echo-eye-height)",
  };

  const mouthStyle: CSSProperties = {
    left: "var(--echo-mouth-left)",
    top: "calc(var(--echo-mouth-top) + var(--echo-mouth-y-adjust, 0%))",
    width: "var(--echo-mouth-width)",
    height: `${1 + safeMouthOpen * 5}%`,
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
        aria-hidden="true"
      />

      <div
        className="echo-avatar-ring echo-avatar-ring-one"
        aria-hidden="true"
      />

      <div
        className="echo-avatar-ring echo-avatar-ring-two"
        aria-hidden="true"
      />

      <div
        className="echo-avatar-ring echo-avatar-ring-three"
        aria-hidden="true"
      />

      <div
        className="echo-avatar-face-overlay"
        style={faceLayerStyle}
        aria-hidden="true"
      >
        <span
          className="echo-avatar-eye-lid echo-avatar-eye-lid-left"
          style={{ ...lidStyle, left: "var(--echo-eye-left)" }}
        />

        <span
          className="echo-avatar-eye-lid echo-avatar-eye-lid-right"
          style={{ ...lidStyle, left: "var(--echo-eye-right)" }}
        />

        <span
          className="echo-avatar-mouth-overlay"
          style={mouthStyle}
        />
      </div>

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

      <div className="echo-avatar-status">
        <span className="echo-avatar-status-dot" />
        {statusText[state]}
      </div>
    </div>
  );
}
