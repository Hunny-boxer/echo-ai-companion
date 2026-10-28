
import { Suspense, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { EchoAvatarState } from "./EchoAvatar";

type Sage3DCharacterProps = {
  state?: EchoAvatarState;
  compact?: boolean;
};

function SageRig({ state }: { state: EchoAvatarState }) {
  const { scene } = useGLTF("/models/sage-rigged.glb");

  // Clone the scene so the character has its own independent skeleton.
  const model = useMemo(
    () => cloneSkeleton(scene) as THREE.Group,
    [scene]
  );

  const rootRef = useRef<THREE.Group | null>(null);

  const bones = useMemo(() => {
    const result: Record<string, THREE.Bone> = {};

    model.traverse((object) => {
      if (object instanceof THREE.Bone) {
        const parts = object.name.split(":");
        const name = parts[parts.length - 1].toLowerCase();
        result[name] = object;
      }
    });

    return result;
  }, [model]);

  // Keep the original rig pose as the baseline for each motion.
  const originalRotations = useMemo(() => {
    const result = new Map<string, THREE.Euler>();

    Object.entries(bones).forEach(([name, bone]) => {
      result.set(name, bone.rotation.clone());
    });

    return result;
  }, [bones]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speaking = state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    if (rootRef.current) {
      // A quiet breathing motion and subtle head-on orientation shift.
      rootRef.current.position.y =
        -0.5 + Math.sin(t * 1.2) * 0.008;

      rootRef.current.rotation.y =
        Math.sin(t * 0.42) * (speaking ? 0.025 : 0.045);
    }

    const breath = Math.sin(t * 1.25) * 0.012;
    const headNod = Math.sin(t * (speaking ? 2.1 : 0.65));

    function rotateBone(
      name: string,
      x = 0,
      y = 0,
      z = 0
    ) {
      const bone = bones[name];
      const base = originalRotations.get(name);

      if (!bone || !base) return;

      bone.rotation.set(
        base.x + x,
        base.y + y,
        base.z + z,
        base.order
      );
    }

    // Head and neck: small listening tilts and thoughtful nods.
    rotateBone(
      "head",
      thinking ? -0.09 + headNod * 0.025 : headNod * 0.025,
      Math.sin(t * 0.45) * 0.07,
      thinking ? -0.07 : listening ? -0.025 : 0
    );

    rotateBone(
      "neck",
      breath + (speaking ? headNod * 0.018 : 0),
      Math.sin(t * 0.6) * 0.025,
      thinking ? -0.025 : 0
    );

    // Torso: subtle breathing and movement while talking.
    rotateBone("spine", breath, 0, 0);
    rotateBone(
      "spine1",
      breath * 0.7,
      speaking ? Math.sin(t * 1.6) * 0.025 : 0,
      0
    );
    rotateBone(
      "spine2",
      speaking ? Math.sin(t * 1.8) * 0.025 : 0,
      0,
      0
    );

    // Arms: gentle, alternating gestures while speaking.
    // Thinking and listening use smaller, calmer movements.
    const gesture = speaking ? 1 : thinking ? 0.16 : listening ? 0.08 : 0.05;
    const leftWave = Math.sin(t * 2.0);
    const rightWave = Math.sin(t * 2.0 + Math.PI * 0.8);

    rotateBone(
      "leftarm",
      speaking ? leftWave * 0.045 : 0,
      Math.sin(t * 0.7) * 0.025,
      -gesture * 0.08 - (speaking ? leftWave * 0.09 : 0)
    );

    rotateBone(
      "rightarm",
      speaking ? rightWave * 0.045 : 0,
      Math.sin(t * 0.7 + 1) * 0.025,
      gesture * 0.08 + (speaking ? rightWave * 0.09 : 0)
    );

    rotateBone(
      "leftforearm",
      speaking ? Math.sin(t * 2.5) * 0.09 : 0,
      speaking ? leftWave * 0.06 : 0,
      speaking ? leftWave * 0.045 : 0
    );

    rotateBone(
      "rightforearm",
      speaking ? Math.sin(t * 2.5 + 1.4) * 0.09 : 0,
      speaking ? rightWave * 0.06 : 0,
      speaking ? rightWave * 0.045 : 0
    );

    // Small wrist movements make the gestures less rigid.
    rotateBone("lefthand", 0, 0, speaking ? leftWave * 0.09 : 0);
    rotateBone("righthand", 0, 0, speaking ? rightWave * 0.09 : 0);
  });

  return (
    <group ref={rootRef} position={[0, -0.5, 0]}>
      <primitive object={model} />
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
    minHeight: compact ? 170 : 260,
    overflow: "hidden",
    isolation: "isolate",
    borderRadius: compact ? 12 : 18,
    background:
      "radial-gradient(ellipse at 50% 40%, rgba(126, 79, 210, 0.24), transparent 66%), linear-gradient(160deg, #1d122e, #0b0812)",
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
        camera={{ position: [0, 0, 2.15], fov: 34, near: 0.1, far: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.6} />

        <directionalLight
          position={[2, 3, 4]}
          intensity={2.1}
          color="#f1e8ff"
        />

        <directionalLight
          position={[-3, 1, -2]}
          intensity={1.2}
          color="#9670ff"
        />

        <pointLight
          position={[0, 1, 1.5]}
          intensity={0.8}
          color="#e1c3ff"
        />

        <Suspense fallback={null}>
          <SageRig state={state} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/sage-rigged.glb");
