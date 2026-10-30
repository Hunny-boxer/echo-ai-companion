import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type {
  CSSProperties,
  ErrorInfo,
  ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import type {
  EchoAvatarExpression,
  EchoAvatarState,
} from "./EchoAvatar";

const MODEL_URL = "/models/sage-rigged-animated%20(2).glb";

type Sage3DCharacterProps = {
  state?: EchoAvatarState;
  compact?: boolean;
  mouthOpen?: number;
  expression?: EchoAvatarExpression;
};

type ModelErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ModelErrorBoundaryState = {
  hasError: boolean;
};

type FacialMorphGroup = {
  mesh: THREE.Mesh;
  blinkIndices: number[];
  mouthIndex: number | null;
  smileIndices: number[];
  browUpIndices: number[];
  browDownIndices: number[];
};

class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Echo Sage 3D model failed to load:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function selectAnimationClip(
  names: string[],
  state: EchoAvatarState
): string | undefined {
  const normalizedNames = names.map((name) => ({
    original: name,
    normalized: normalizeName(name),
  }));

  const preferred = {
    speaking: [
      "talkinggesture",
      "talkgesture",
      "talking",
      "speaking",
      "talk",
      "speak",
      "gesture",
    ],
    thinking: ["thinking", "think", "ponder", "consider"],
    listening: ["listening", "listen", "attentive", "attention"],
    idle: ["idle", "breathing", "breath", "rest", "standing"],
  }[state];

  for (const keyword of preferred) {
    const match = normalizedNames.find((item) =>
      item.normalized.includes(keyword)
    );

    if (match) {
      return match.original;
    }
  }

  const idle = normalizedNames.find((item) =>
    item.normalized.includes("idle")
  );

  return idle?.original ?? names[0];
}

/**
 * Discover facial morph targets instead of assuming every model
 * has the same names or even has facial morph targets.
 */
function collectFacialMorphs(model: THREE.Group): FacialMorphGroup[] {
  const groups: FacialMorphGroup[] = [];

  model.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (
      !mesh.isMesh ||
      !mesh.morphTargetDictionary ||
      !mesh.morphTargetInfluences
    ) {
      return;
    }

    const targets = Object.entries(mesh.morphTargetDictionary).map(
      ([name, index]) => ({
        name,
        normalized: normalizeName(name),
        index,
      })
    );

    const blinkIndices = targets
      .filter((target) => target.normalized.includes("blink"))
      .map((target) => target.index);

    const mouthPriority = [
      "jawopen",
      "mouthopen",
      "visemeaa",
      "visemeah",
      "visemeo",
      "moutha",
    ];

    let mouthIndex: number | null = null;

    for (const targetName of mouthPriority) {
      const target = targets.find((item) =>
        item.normalized.includes(targetName)
      );

      if (target) {
        mouthIndex = target.index;
        break;
      }
    }

    const smileIndices = targets
      .filter(
        (target) =>
          target.normalized.includes("mouthsmile") ||
          target.normalized === "smile" ||
          target.normalized.includes("mouthhappy")
      )
      .map((target) => target.index);

    const browUpIndices = targets
      .filter(
        (target) =>
          target.normalized.includes("browinnerup") ||
          target.normalized.includes("browouterup") ||
          target.normalized.includes("browraise")
      )
      .map((target) => target.index);

    const browDownIndices = targets
      .filter(
        (target) =>
          target.normalized.includes("browdown") ||
          target.normalized.includes("browlower")
      )
      .map((target) => target.index);

    if (
      blinkIndices.length ||
      mouthIndex !== null ||
      smileIndices.length ||
      browUpIndices.length ||
      browDownIndices.length
    ) {
      groups.push({
        mesh,
        blinkIndices,
        mouthIndex,
        smileIndices,
        browUpIndices,
        browDownIndices,
      });
    }
  });

  return groups;
}

function getBlinkAmount(time: number): number {
  // A quick blink followed by a smaller double-blink sometimes.
  const cycle = time % 5.2;

  if (cycle < 0.14) {
    return Math.sin((cycle / 0.14) * Math.PI);
  }

  if (cycle >= 0.27 && cycle < 0.38) {
    return Math.sin(((cycle - 0.27) / 0.11) * Math.PI) * 0.85;
  }

  return 0;
}

function updateFacialMorphs(
  groups: FacialMorphGroup[],
  state: EchoAvatarState,
  expression: EchoAvatarExpression,
  mouthOpen: number,
  time: number
) {
  const blink = getBlinkAmount(time);
  const speaking = state === "speaking";

  for (const group of groups) {
    const influences = group.mesh.morphTargetInfluences;

    if (!influences) continue;

    for (const index of group.blinkIndices) {
      influences[index] = blink;
    }

    if (group.mouthIndex !== null) {
      influences[group.mouthIndex] = speaking ? mouthOpen : 0;
    }

    const smileAmount = expression === "warm" ? 0.2 : 0;
    const browUpAmount = expression === "curious" ? 0.16 : 0;
    const browDownAmount =
      expression === "concerned"
        ? 0.13
        : expression === "focused"
          ? 0.07
          : 0;

    for (const index of group.smileIndices) {
      influences[index] = smileAmount;
    }

    for (const index of group.browUpIndices) {
      influences[index] = browUpAmount;
    }

    for (const index of group.browDownIndices) {
      influences[index] = browDownAmount;
    }
  }
}

function SageRig({
  state,
  compact,
  mouthOpen,
  expression,
}: {
  state: EchoAvatarState;
  compact: boolean;
  mouthOpen?: number;
  expression: EchoAvatarExpression;
}) {
  const { scene, animations } = useGLTF(MODEL_URL);

  const model = useMemo(
    () => cloneSkeleton(scene) as THREE.Group,
    [scene]
  );

  const framing = useMemo(() => {
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    // The compact companion card uses a tighter upper-body portrait crop.
    // The standalone view keeps the original full-character framing.
    const targetHeight = compact ? 2.0 : 1.85;
    const scale = targetHeight / Math.max(size.y, 0.001);

    return {
      scale,
      position: new THREE.Vector3(
        -center.x * scale,
        -center.y * scale - (compact ? 0.25 : 0),
        -center.z * scale
      ),
    };
  }, [model, compact]);

  const facialMorphs = useMemo(
    () => collectFacialMorphs(model),
    [model]
  );

  const { actions, names } = useAnimations(animations, model);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const root = useRef<THREE.Group | null>(null);
  const motionGroup = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const clipName = selectAnimationClip(names, state);
    const next = clipName ? actions[clipName] : undefined;

    if (!next || activeAction.current === next) return;

    const previous = activeAction.current;

    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.play();

    if (previous) {
      previous.crossFadeTo(next, 0.38, false);
    } else {
      next.fadeIn(0.3);
    }

    activeAction.current = next;
  }, [actions, names, state]);

  useEffect(() => {
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
      activeAction.current = null;
    };
  }, [actions]);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();

    if (root.current) {
      const breathing = Math.sin(time * 1.25);

      root.current.position.y =
        breathing * (state === "speaking" ? 0.008 : 0.006);

      root.current.rotation.y =
        Math.sin(time * 0.38) *
        (state === "speaking" ? 0.025 : 0.035);
    }

    if (motionGroup.current) {
      const speakingNod =
        state === "speaking"
          ? Math.sin(time * 6.2) * 0.012
          : 0;

      const thinkingLean =
        state === "thinking"
          ? 0.035 + Math.sin(time * 0.65) * 0.006
          : 0;

      const listeningLean = state === "listening" ? 0.014 : 0;

      const targetX =
        thinkingLean +
        listeningLean +
        speakingNod +
        (state === "idle" ? Math.sin(time * 0.7) * 0.004 : 0);

      const targetY =
        Math.sin(time * 0.5) * 0.018 +
        (state === "listening" ? Math.sin(time * 0.8) * 0.008 : 0);

      const targetZ =
        state === "thinking"
          ? -0.035
          : state === "listening"
            ? -0.012
            : state === "speaking"
              ? Math.sin(time * 3.1) * 0.008
              : Math.sin(time * 0.45) * 0.006;

      motionGroup.current.rotation.x = THREE.MathUtils.damp(
        motionGroup.current.rotation.x,
        targetX,
        4,
        delta
      );

      motionGroup.current.rotation.y = THREE.MathUtils.damp(
        motionGroup.current.rotation.y,
        targetY,
        3,
        delta
      );

      motionGroup.current.rotation.z = THREE.MathUtils.damp(
        motionGroup.current.rotation.z,
        targetZ,
        3,
        delta
      );
    }

    // App.tsx feeds the browser speech controller's live mouthOpen value.
    // Facial movement is applied only when the model exposes matching morphs.
    const safeMouthOpen =
      state !== "speaking"
        ? 0
        : mouthOpen === undefined
          ? 0.15 + Math.abs(Math.sin(time * 7.5)) * 0.55
          : THREE.MathUtils.clamp(mouthOpen, 0, 1);

    updateFacialMorphs(
      facialMorphs,
      state,
      expression,
      safeMouthOpen,
      time
    );
  });

  return (
    <group ref={root}>
      <group ref={motionGroup}>
        <group scale={framing.scale} position={framing.position}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

function HologramPlatform() {
  const outer = useRef<THREE.Mesh | null>(null);
  const inner = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (outer.current) outer.current.rotation.z = time * 0.12;
    if (inner.current) inner.current.rotation.z = -time * 0.17;
  });

  return (
    <group position={[0, -0.86, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 80]} />
        <meshBasicMaterial
          color="#6438ec"
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.635, 96]} />
        <meshBasicMaterial
          color="#58f5ff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.88, 0.008, 8, 96]} />
        <meshBasicMaterial
          color="#58f5ff"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.006, 8, 80]} />
        <meshBasicMaterial
          color="#ad91ff"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function Sage3DCharacter({
  state = "idle",
  compact = false,
  mouthOpen,
  expression = "neutral",
}: Sage3DCharacterProps) {
  const stageStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: compact ? 190 : 280,
    overflow: "hidden",
    isolation: "isolate",
    borderRadius: compact ? 12 : 18,
    background: compact
      ? "transparent"
      : "radial-gradient(ellipse at 50% 38%, rgba(126,79,210,.2), transparent 65%), linear-gradient(160deg,#241437,#0b0812)",
  };

  const portraitFallback = (
    <img
      src="/personas/sage.png"
      alt="Sage"
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center top",
      }}
    />
  );

  return (
    <div
      className={`sage-3d-character sage-3d-character-${state}`}
      style={stageStyle}
      role="img"
      aria-label={`Sage 3D character, ${state}, ${expression} expression`}
    >
      <ModelErrorBoundary fallback={portraitFallback}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [0, compact ? 0.02 : 0.05, compact ? 2.35 : 3.2],
            fov: compact ? 34 : 36,
            near: 0.01,
            far: 100,
          }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.85} />

          <directionalLight
            position={[2, 3, 4]}
            intensity={1.35}
            color="#fff5ff"
          />

          <directionalLight
            position={[-3, 1, -2]}
            intensity={0.7}
            color="#8996ff"
          />

          <pointLight
            position={[0, 1, 1.5]}
            intensity={0.45}
            color="#a78bfa"
          />

          {!compact && <HologramPlatform />}

          <Suspense fallback={portraitFallback}>
            <SageRig
              state={state}
              compact={compact}
              mouthOpen={mouthOpen}
              expression={expression}
            />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
