
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { EchoAvatarState } from "./EchoAvatar";

const SAGE_MODEL_URL = "/models/sage-rigged-animated%20(2).glb";

type Sage3DCharacterProps = {
  state?: EchoAvatarState;
  compact?: boolean;
};

function SageRig({ state }: { state: EchoAvatarState }) {
  const { scene, animations } = useGLTF(SAGE_MODEL_URL);

  const model = useMemo(
    () => cloneSkeleton(scene) as THREE.Group,
    [scene]
  );

  // Measure and center the character automatically.
  const framing = useMemo(() => {
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 1.85 / maxDimension;

    return {
      scale,
      position: new THREE.Vector3(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      ),
    };
  }, [model]);

  const { actions } = useAnimations(animations, model);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const root = useRef<THREE.Group | null>(null);

  // Choose the real animation embedded in the GLB.
  useEffect(() => {
    const clipName =
      state === "speaking"
        ? "TalkingGesture"
        : state === "thinking"
          ? "Thinking"
          : "Idle";

    const next = actions[clipName] ?? actions["Idle"];

    if (!next || activeAction.current === next) return;

    const previous = activeAction.current;

    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.play();

    if (previous) {
      previous.crossFadeTo(next, 0.3, false);
    } else {
      next.fadeIn(0.25);
    }

    activeAction.current = next;
  }, [actions, state]);

  useEffect(() => {
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
      activeAction.current = null;
    };
  }, [actions]);

  // Gentle stage movement, layered on top of the real skeletal animation.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (!root.current) return;

    root.current.position.y = Math.sin(t * 1.2) * 0.008;
    root.current.rotation.y =
      Math.sin(t * 0.42) * (state === "speaking" ? 0.025 : 0.04);
  });

  return (
    <group ref={root}>
      <group scale={framing.scale} position={framing.position}>
        <primitive object={model} />
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
    <group position={[0, -0.87, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 80]} />
        <meshBasicMaterial
          color="#6438ec"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.635, 96]} />
        <meshBasicMaterial
          color="#58f5ff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.88, 0.009, 8, 96]} />
        <meshBasicMaterial
          color="#58f5ff"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.006, 8, 80]} />
        <meshBasicMaterial
          color="#ad91ff"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function Sage3DCharacter({
  state = "idle",
  compact = false,
}: Sage3DCharacterProps) {
  const stageStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: compact ? 170 : 280,
    overflow: "hidden",
    isolation: "isolate",
    borderRadius: compact ? 12 : 18,
    background: compact
      ? "transparent"
      : "radial-gradient(ellipse at 50% 38%, rgba(126,79,210,.25), transparent 65%), linear-gradient(160deg,#1d122e,#0b0812)",
  };

  return (
    <div
      className={`sage-3d-character sage-3d-character-${state}`}
      style={stageStyle}
      role="img"
      aria-label={`Sage 3D character, ${state}`}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [0, 0.05, compact ? 2.6 : 3.0],
          fov: 38,
          near: 0.01,
          far: 100,
        }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />

        <directionalLight
          position={[2, 3, 4]}
          intensity={2.1}
          color="#f1e8ff"
        />

        <directionalLight
          position={[-3, 1, -2]}
          intensity={1.35}
          color="#4ecfff"
        />

        <pointLight
          position={[0, 1, 1.5]}
          intensity={0.85}
          color="#a78bff"
        />

        {!compact && <HologramPlatform />}

        <Suspense fallback={null}>
          <SageRig state={state} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(SAGE_MODEL_URL);
