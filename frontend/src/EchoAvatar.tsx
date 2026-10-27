
import { useId } from "react";
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

const palettes = {
  sage: {
    faceStart: "#f1e7ff",
    faceMid: "#9274d7",
    faceEnd: "#30203f",
    bodyStart: "#c5a8ff",
    bodyMid: "#59427f",
    bodyEnd: "#17101f",
    visorStart: "#28163d",
    visorEnd: "#100b19",
    eyeStart: "#ffffff",
    eyeMid: "#e5d4ff",
    eyeEnd: "#a16aff",
    outline: "#d9c6ff",
    accent: "#b79aff",
    panel: "#473263",
    hairStart: "#e6d3ff",
    hairEnd: "#61458c",
    background: "#120b21",
  },
  nova: {
    faceStart: "#ffe8d5",
    faceMid: "#edaa79",
    faceEnd: "#65332b",
    bodyStart: "#ffc18c",
    bodyMid: "#8a4a3c",
    bodyEnd: "#211019",
    visorStart: "#48241f",
    visorEnd: "#1d0e16",
    eyeStart: "#fffbe8",
    eyeMid: "#ffd990",
    eyeEnd: "#ff943b",
    outline: "#ffd1a4",
    accent: "#ffb66f",
    panel: "#753d31",
    hairStart: "#ffe1a6",
    hairEnd: "#e8793c",
    background: "#21100e",
  },
  atlas: {
    faceStart: "#d9f1ff",
    faceMid: "#6d9bc7",
    faceEnd: "#152b48",
    bodyStart: "#86caff",
    bodyMid: "#325d91",
    bodyEnd: "#0c162a",
    visorStart: "#142842",
    visorEnd: "#071322",
    eyeStart: "#f4ffff",
    eyeMid: "#8ceaff",
    eyeEnd: "#2f9dff",
    outline: "#b4e5ff",
    accent: "#63caff",
    panel: "#214c75",
    hairStart: "#a8dfff",
    hairEnd: "#244f83",
    background: "#08182b",
  },
} as const;

export default function EchoAvatar({
  state = "idle",
  size = "panel",
  persona = "sage",
  label = "Echo AI assistant",
  expression = "neutral",
  mouthOpen = 0.35,
}: EchoAvatarProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const colors = palettes[persona];

  const safeMouthOpen = Math.max(
    0,
    Math.min(1, Number.isFinite(mouthOpen) ? mouthOpen : 0)
  );

  return (
    <div
      className={[
        "echo-avatar",
        `echo-avatar-${size}`,
        `echo-avatar-persona-${persona}`,
        `echo-avatar-state-${state}`,
        `echo-avatar-expression-${expression}`,
      ].join(" ")}
      role="img"
      aria-label={`${label}, ${persona}, ${state}, ${expression} expression`}
    >
      <div className="echo-avatar-halo" />
      <div className="echo-avatar-ring echo-avatar-ring-one" />
      <div className="echo-avatar-ring echo-avatar-ring-two" />
      <div className="echo-avatar-ring echo-avatar-ring-three" />

      <svg
        className="echo-avatar-art"
        viewBox="0 0 240 280"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${id}-face`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor={colors.faceStart} />
            <stop offset="40%" stopColor={colors.faceMid} />
            <stop offset="100%" stopColor={colors.faceEnd} />
          </linearGradient>

          <linearGradient
            id={`${id}-body`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor={colors.bodyStart} />
            <stop offset="50%" stopColor={colors.bodyMid} />
            <stop offset="100%" stopColor={colors.bodyEnd} />
          </linearGradient>

          <linearGradient
            id={`${id}-visor`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={colors.visorStart} />
            <stop offset="100%" stopColor={colors.visorEnd} />
          </linearGradient>

          <linearGradient
            id={`${id}-hair`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor={colors.hairStart} />
            <stop offset="100%" stopColor={colors.hairEnd} />
          </linearGradient>

          <radialGradient id={`${id}-eye`}>
            <stop offset="0%" stopColor={colors.eyeStart} />
            <stop offset="38%" stopColor={colors.eyeMid} />
            <stop offset="100%" stopColor={colors.eyeEnd} />
          </radialGradient>

          <filter
            id={`${id}-glow`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* NOVA: preserve the original warm android hairstyle. */}
        {persona === "nova" && (
          <g className="echo-avatar-hair">
            <path
              d="M76 78
                 C44 63 49 35 77 35
                 C79 12 111 14 120 23
                 C144 8 169 23 169 42
                 C199 47 198 79 175 102
                 L168 134 L154 88
                 L88 83 L70 130Z"
              fill={`url(#${id}-hair)`}
              stroke={colors.outline}
              strokeWidth="2"
            />

            <path
              d="M78 60
                 C86 31 123 27 143 42
                 C153 26 170 39 174 55
                 L155 68
                 C139 53 130 50 119 53
                 C103 56 93 69 84 82Z"
              fill={colors.hairEnd}
              stroke={colors.outline}
              strokeWidth="1.4"
            />

            <path
              d="M69 75 Q49 101 67 139
                 M174 72 Q194 101 175 138"
              fill="none"
              stroke={colors.accent}
              strokeWidth="9"
              strokeLinecap="round"
            />

            <path
              d="M67 81 Q54 111 70 131
                 M175 80 Q187 112 173 131"
              fill="none"
              stroke="#fff0c8"
              strokeOpacity=".75"
              strokeWidth="2"
            />

            <circle
              cx="176"
              cy="91"
              r="13"
              fill={colors.panel}
              stroke={colors.outline}
              strokeWidth="2"
            />

            <circle
              cx="176"
              cy="91"
              r="5"
              fill={`url(#${id}-eye)`}
              filter={`url(#${id}-glow)`}
            />
          </g>
        )}

        {/* ATLAS: preserve the original angular helmet. */}
        {persona === "atlas" && (
          <g className="echo-avatar-helmet">
            <path
              d="M74 84 L61 63 L82 31
                 L104 19 L136 19 L158 31
                 L179 63 L166 84 L174 133
                 L153 157 L120 177 L87 157
                 L66 133Z"
              fill={`url(#${id}-body)`}
              stroke={colors.outline}
              strokeWidth="2.5"
            />

            <path
              d="M83 57 L99 36 L141 36 L157 57
                 L148 68 L92 68Z"
              fill={colors.panel}
              stroke={colors.outline}
              strokeWidth="1.8"
            />

            <path
              d="M95 45 L145 45"
              stroke="#f1fbff"
              strokeOpacity=".8"
              strokeWidth="2"
            />

            <path
              d="M69 92 L47 99 L47 133 L68 141
                 M171 92 L193 99 L193 133 L172 141"
              fill={colors.panel}
              stroke={colors.outline}
              strokeWidth="2.5"
            />

            <path
              d="M53 108 L63 111 L63 124 L53 127
                 M187 108 L177 111 L177 124 L187 127"
              fill="none"
              stroke={colors.accent}
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* SAGE: preserve the monk-inspired crown knot. */}
        {persona === "sage" && (
          <g className="echo-avatar-knot">
            <ellipse
              cx="120"
              cy="29"
              rx="18"
              ry="16"
              fill={`url(#${id}-body)`}
              stroke={colors.outline}
              strokeWidth="2"
            />

            <path
              d="M107 28 Q120 11 133 28
                 M109 34 Q120 20 131 34"
              fill="none"
              stroke={colors.accent}
              strokeWidth="2"
              strokeLinecap="round"
            />

            <circle
              cx="120"
              cy="29"
              r="4"
              fill={`url(#${id}-eye)`}
              filter={`url(#${id}-glow)`}
            />
          </g>
        )}

        {/* Shared body, with each persona's original styling. */}
        <g className="echo-avatar-body">
          <path
            d="M35 258
               C43 218 65 196 94 190
               L96 164 L144 164 L146 190
               C175 196 197 218 205 258
               Q120 278 35 258Z"
            fill={`url(#${id}-body)`}
            stroke={colors.outline}
            strokeOpacity=".9"
            strokeWidth="1.8"
          />

          <path
            d="M48 243 L74 222 L97 226
               L120 247 L143 226 L166 222 L192 243"
            fill="none"
            stroke={colors.accent}
            strokeWidth="2"
          />

          <path
            d="M96 190 L120 211 L144 190"
            fill="none"
            stroke={colors.outline}
            strokeWidth="2.4"
          />

          <path
            d="M80 221 L103 236 L96 263
                 M160 221 L137 236 L144 263"
            fill="none"
            stroke={colors.accent}
            strokeWidth="2.2"
          />

          {persona === "sage" && (
            <g className="echo-avatar-prayer-beads">
              <path
                d="M94 188 Q120 228 146 188"
                fill="none"
                stroke="#e2c7ff"
                strokeWidth="4"
              />

              {Array.from({ length: 7 }, (_, index) => {
                const angle = (Math.PI * index) / 6;
                const x = 120 + Math.sin(angle) * 25;
                const y = 190 + (1 - Math.cos(angle)) * 20;

                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3.2"
                    fill="#e7d4ff"
                    stroke="#8d6bc9"
                    strokeWidth="1"
                  />
                );
              })}
            </g>
          )}

          {persona === "nova" && (
            <g>
              <path
                d="M67 219 L91 205 L106 222
                   M173 219 L149 205 L134 222"
                fill="none"
                stroke="#ffe2b4"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <circle
                cx="94"
                cy="238"
                r="5"
                fill={`url(#${id}-eye)`}
                filter={`url(#${id}-glow)`}
              />

              <circle
                cx="146"
                cy="238"
                r="5"
                fill={`url(#${id}-eye)`}
                filter={`url(#${id}-glow)`}
              />
            </g>
          )}

          {persona === "atlas" && (
            <g>
              <path
                d="M61 215 L92 201 L109 220 L102 254
                   M179 215 L148 201 L131 220 L138 254"
                fill="none"
                stroke={colors.outline}
                strokeWidth="3"
              />

              <path
                d="M107 230 L120 238 L133 230 L128 251 L112 251Z"
                fill={colors.panel}
                stroke={colors.outline}
                strokeWidth="1.8"
              />
            </g>
          )}
        </g>

        {/* Head side housings. */}
        {persona !== "nova" && (
          <g>
            <path
              d="M68 91 L49 98 L49 137 L69 145"
              fill={colors.panel}
              stroke={colors.outline}
              strokeWidth="2"
            />

            <path
              d="M172 91 L191 98 L191 137 L171 145"
              fill={colors.panel}
              stroke={colors.outline}
              strokeWidth="2"
            />

            <path
              d="M52 108 L63 111 L63 127 L52 130
                 M188 108 L177 111 L177 127 L188 130"
              stroke={colors.accent}
              strokeWidth="2"
              fill="none"
            />
          </g>
        )}

        {/* Main head shell. */}
        <g
          className="echo-avatar-head"
          style={{
            transformBox: "view-box",
            transformOrigin: "center 110px",
          } as CSSProperties}
        >
          <path
            d={
              persona === "atlas"
                ? "M77 46 L94 33 L146 33 L163 46 L174 88 L172 128 Q165 166 120 183 Q75 166 68 128 L66 88Z"
                : "M77 48 Q120 14 163 48 L174 89 L172 128 Q165 166 120 183 Q75 166 68 128 L66 89Z"
            }
            fill={`url(#${id}-face)`}
            stroke={colors.outline}
            strokeWidth="2"
          />

          {/* Nova's signature fringe. */}
          {persona === "nova" && (
            <path
              d="M76 61
                 Q87 29 119 39
                 Q142 30 163 58
                 L153 70
                 Q139 52 126 54
                 Q103 53 89 76Z"
              fill={`url(#${id}-hair)`}
              stroke={colors.outline}
              strokeWidth="1.4"
            />
          )}

          {/* Face visor. */}
          <path
            d="M82 78 Q120 63 162 78
               L159 119 Q153 145 120 160
               Q87 145 81 119Z"
            fill={`url(#${id}-visor)`}
            stroke={colors.accent}
            strokeWidth="1.6"
          />

          {persona === "sage" && (
            <path
              d="M120 79 L126 91 L120 103 L114 91Z"
              fill={`url(#${id}-eye)`}
              filter={`url(#${id}-glow)`}
            />
          )}

          {persona === "atlas" && (
            <path
              d="M89 83 L108 78 M132 78 L151 83"
              stroke={colors.accent}
              strokeWidth="3"
              strokeLinecap="square"
            />
          )}

          {persona === "nova" && (
            <path
              d="M88 86 Q99 79 109 86
                 M131 86 Q141 79 152 86"
              fill="none"
              stroke={colors.accent}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {/* Luminous eyes. Original character proportions are retained. */}
          <g className="echo-avatar-eyes">
            <ellipse
              cx="99"
              cy="105"
              rx={persona === "atlas" ? 13 : 12}
              ry={
                expression === "concerned"
                  ? 5.5
                  : expression === "curious"
                    ? persona === "nova" ? 9 : 8
                    : persona === "nova" ? 8 : 7
              }
              fill={`url(#${id}-eye)`}
              filter={`url(#${id}-glow)`}
            />

            <ellipse
              cx="141"
              cy="105"
              rx={persona === "atlas" ? 13 : 12}
              ry={
                expression === "concerned"
                  ? 5.5
                  : expression === "curious"
                    ? persona === "nova" ? 9 : 8
                    : persona === "nova" ? 8 : 7
              }
              fill={`url(#${id}-eye)`}
              filter={`url(#${id}-glow)`}
            />

            <circle cx="99" cy="105" r="2.5" fill="#ffffff" />
            <circle cx="141" cy="105" r="2.5" fill="#ffffff" />
          </g>

          {/* Nose and cheek details. */}
          <path
            d="M83 117 L91 133 L101 137
               M157 117 L149 133 L139 137"
            fill="none"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />

          <path
            d="M120 104 L115 121 L120 124 L125 121"
            fill="none"
            stroke={colors.outline}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/*
            Expression-aware mouth:
            idle uses each persona's original mouth;
            other expressions change the mouth curve;
            speaking uses a mouth that responds to mouthOpen.
          */}
          <g className="echo-avatar-mouth">
            {state === "speaking" ? (
              <ellipse
                className="echo-avatar-speaking-mouth"
                cx="120"
                cy="142"
                rx={7 + safeMouthOpen * 3}
                ry={2 + safeMouthOpen * 9}
                fill={colors.visorEnd}
                stroke={colors.outline}
                strokeWidth="2"
                style={
                  {
                    "--echo-mouth-open": String(safeMouthOpen),
                  } as CSSProperties
                }
              />
            ) : expression === "warm" ? (
              <path
                d="M101 137 Q120 155 139 137"
                fill="none"
                stroke={colors.outline}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            ) : expression === "curious" ? (
              <path
                d="M109 142 Q120 133 131 142"
                fill="none"
                stroke={colors.outline}
                strokeWidth="2.7"
                strokeLinecap="round"
              />
            ) : expression === "concerned" ? (
              <path
                d="M103 147 Q120 135 137 147"
                fill="none"
                stroke={colors.outline}
                strokeWidth="2.7"
                strokeLinecap="round"
              />
            ) : expression === "focused" ? (
              <path
                d="M108 141 L132 141"
                fill="none"
                stroke={colors.outline}
                strokeWidth="2.8"
                strokeLinecap="square"
              />
            ) : persona === "sage" ? (
              <path
                d="M104 140 Q120 146 136 140"
                fill="none"
                stroke={colors.outline}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : persona === "nova" ? (
              <>
                <path
                  d="M101 137 Q120 153 139 137"
                  fill="none"
                  stroke={colors.outline}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                <path
                  d="M109 143 Q120 148 131 143"
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <path
                d="M108 140 L132 140"
                fill="none"
                stroke={colors.outline}
                strokeWidth="2.8"
                strokeLinecap="square"
              />
            )}
          </g>
        </g>

        {/* Sage's original joined-hands meditation pose. */}
        {persona === "sage" && (
          <g
            className="echo-avatar-prayer-hands"
            stroke={colors.outline}
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            <path
              d="M120 220
                 L108 202 L105 184
                 Q104 180 108 180
                 L118 199 L116 180
                 Q117 176 120 181
                 L124 200 L126 184
                 Q130 181 131 188
                 L131 205 L137 195
                 Q141 192 142 198
                 L132 219Z"
              fill={`url(#${id}-face)`}
            />

            <path
              d="M120 220 L108 207 L120 202 L132 207Z"
              fill={colors.panel}
            />

            <path
              d="M109 192 L117 205 M131 192 L123 205"
              fill="none"
              stroke={colors.accent}
              strokeWidth="2"
            />
          </g>
        )}

        {/* Small shoulder lights. */}
        <circle
          cx="76"
          cy="153"
          r="2.5"
          fill={colors.outline}
          filter={`url(#${id}-glow)`}
        />

        <circle
          cx="164"
          cy="153"
          r="2.5"
          fill={colors.outline}
          filter={`url(#${id}-glow)`}
        />

        <path
          d="M106 177 L120 185 L134 177"
          fill="none"
          stroke={colors.accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div className="echo-avatar-particle echo-avatar-particle-one" />
      <div className="echo-avatar-particle echo-avatar-particle-two" />
      <div className="echo-avatar-particle echo-avatar-particle-three" />

      <div className="echo-avatar-status">
        <span className="echo-avatar-status-dot" />
        {state === "idle" && "Ready"}
        {state === "listening" && "Listening"}
        {state === "thinking" && "Thinking"}
        {state === "speaking" && "Speaking"}
      </div>
    </div>
  );
}
