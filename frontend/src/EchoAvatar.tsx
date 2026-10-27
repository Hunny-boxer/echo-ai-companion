import { useId } from "react";
import "./echo-avatar.css";

export type EchoAvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

type EchoAvatarProps = {
  state?: EchoAvatarState;
  size?: "hero" | "panel" | "chat";
  label?: string;
};

export default function EchoAvatar({
  state = "idle",
  size = "panel",
  label = "Echo AI assistant",
}: EchoAvatarProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");

  return (
    <div
      className={`echo-avatar echo-avatar-${size} echo-avatar-state-${state}`}
      role="img"
      aria-label={`${label}, ${state}`}
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
            <stop offset="0%" stopColor="#f0e7ff" />
            <stop offset="35%" stopColor="#b8a0ff" />
            <stop offset="70%" stopColor="#6854ac" />
            <stop offset="100%" stopColor="#272044" />
          </linearGradient>

          <linearGradient
            id={`${id}-body`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="#9e83ff" stopOpacity=".8" />
            <stop offset="50%" stopColor="#44366e" stopOpacity=".8" />
            <stop offset="100%" stopColor="#171425" />
          </linearGradient>

          <linearGradient
            id={`${id}-visor`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#261b48" />
            <stop offset="100%" stopColor="#100e20" />
          </linearGradient>

          <radialGradient id={`${id}-eye`}>
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#e7dcff" />
            <stop offset="100%" stopColor="#8a6cff" />
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

        {/* Shoulder armor and upper body */}
        <g className="echo-avatar-body">
          <path
            d="M35 258 C43 218 65 196 94 190 L96 164
               L144 164 L146 190
               C175 196 197 218 205 258
               Q120 278 35 258Z"
            fill={`url(#${id}-body)`}
            stroke="#b7a0ff"
            strokeOpacity=".8"
            strokeWidth="1.5"
          />

          <path
            d="M96 190 L120 211 L144 190"
            fill="none"
            stroke="#d6c7ff"
            strokeWidth="2"
            strokeOpacity=".75"
          />

          <path
            d="M80 221 L103 236 L96 263 M160 221 L137 236 L144 263"
            fill="none"
            stroke="#8c70ef"
            strokeWidth="2"
          />

          <path
            d="M66 245 L91 249 M174 245 L149 249"
            stroke="#d1bfff"
            strokeWidth="1.5"
            strokeOpacity=".8"
          />
        </g>

        {/* Side housings */}
        <g className="echo-avatar-ears">
          <path
            d="M68 91 L49 98 L49 137 L69 145"
            fill="#30244f"
            stroke="#b5a0ff"
            strokeWidth="2"
          />
          <path
            d="M172 91 L191 98 L191 137 L171 145"
            fill="#30244f"
            stroke="#b5a0ff"
            strokeWidth="2"
          />

          <path
            d="M52 108 L63 111 L63 127 L52 130
               M188 108 L177 111 L177 127 L188 130"
            stroke="#dfd4ff"
            strokeWidth="2"
            fill="none"
          />
        </g>

        {/* Head shell */}
        <path
          d="M77 48
             Q120 14 163 48
             L174 89
             L172 128
             Q165 166 120 183
             Q75 166 68 128
             L66 89Z"
          fill={`url(#${id}-face)`}
          stroke="#d9cbff"
          strokeWidth="1.8"
        />

        {/* Forehead armor */}
        <path
          d="M82 49 Q120 27 158 49
             L151 68 Q120 56 89 68Z"
          fill="#44346f"
          stroke="#c9b5ff"
          strokeOpacity=".8"
          strokeWidth="1"
        />

        <path
          d="M92 48 Q120 38 148 48"
          fill="none"
          stroke="#f0eaff"
          strokeWidth="1.5"
          strokeOpacity=".8"
        />

        {/* Central status light */}
        <circle
          cx="120"
          cy="57"
          r="5"
          fill={`url(#${id}-eye)`}
          filter={`url(#${id}-glow)`}
        />

        {/* Face visor */}
        <path
          d="M78 78 Q120 63 162 78
             L159 119
             Q153 145 120 160
             Q87 145 81 119Z"
          fill={`url(#${id}-visor)`}
          stroke="#8e79e8"
          strokeWidth="1.4"
        />

        {/* Brow lines */}
        <path
          d="M89 91 L108 87 M132 87 L151 91"
          stroke="#977fff"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Animated eyes */}
        <g className="echo-avatar-eyes">
          <ellipse
            cx="99"
            cy="105"
            rx="12"
            ry="7"
            fill={`url(#${id}-eye)`}
            filter={`url(#${id}-glow)`}
          />
          <ellipse
            cx="141"
            cy="105"
            rx="12"
            ry="7"
            fill={`url(#${id}-eye)`}
            filter={`url(#${id}-glow)`}
          />

          <circle cx="99" cy="105" r="2.5" fill="#ffffff" />
          <circle cx="141" cy="105" r="2.5" fill="#ffffff" />
        </g>

        {/* Cheek panels */}
        <path
          d="M83 117 L91 133 L101 137
             M157 117 L149 133 L139 137"
          fill="none"
          stroke="#7e69cf"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Nose bridge */}
        <path
          d="M120 104 L115 121 L120 124 L125 121"
          fill="none"
          stroke="#c5b5ff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Mouth and speech animation */}
        <g className="echo-avatar-mouth">
          <path
            d="M103 139 Q120 147 137 139"
            fill="none"
            stroke="#d8caff"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M110 145 L130 145"
            fill="none"
            stroke="#9277ff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>

        {/* Small luminous details */}
        <circle
          cx="76"
          cy="153"
          r="2.5"
          fill="#d6c5ff"
          filter={`url(#${id}-glow)`}
        />
        <circle
          cx="164"
          cy="153"
          r="2.5"
          fill="#d6c5ff"
          filter={`url(#${id}-glow)`}
        />

        <path
          d="M106 177 L120 185 L134 177"
          fill="none"
          stroke="#c8b4ff"
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
