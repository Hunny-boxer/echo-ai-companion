
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

function canonicalBoneName(name: string): string {
  const lastPart = name.split(":").pop() ?? name;
  return lastPart.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function SageRig({ state }: { state: EchoAvatarState }) {
  const { scene } = useGLTF("/models/sage-rigged.glb");

  const model = useMemo(
    () => cloneSkeleton(scene) as THREE.Group,
    [scene]
  );

  // Automatically fit the imported model instead of assuming its units.
  const frame = useMemo(() => {
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const largestDimension = Math.max(
      size.x,
      size.y,
      size.z,
      0.001
    );

    // Fit Sage to the viewport while preserving the original proportions.
    const scale = 1.38 / largestDimension;

    return {
      center,
      scale,
      offset: new THREE.Vector3(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      ),
    };
  }, [model]);

  const rootRef = useRef<THREE.Group | null>(null);

  const bones = useMemo(() => {
    const found: Record<string, THREE.Bone> = {};

    model.traverse((object) => {
      if (object instanceof THREE.Bone) {
        found[canonicalBoneName(object.name)] = object;
      }
    });

    return found;
  }, [model]);

  const originalRotations = useMemo(() => {
    const rotations = new Map<THREE.Bone, THREE.Euler>();

    Object.values(bones).forEach((bone) => {
      rotations.set(bone, bone.rotation.clone());
    });

    return rotations;
  }, [bones]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speaking = state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    if (rootRef.current) {
      // Subtle breathing and natural orientation changes.
      rootRef.current.position.y = Math.sin(t * 1.2) * 0.009;
      rootRef.current.rotation.y =
        Math.sin(t * 0.42) * (speaking ? 0.035 : 0.055);
    }

    const headMotion = Math.sin(t * (speaking ? 2.1 : 0.65));
    const breath = Math.sin(t * 1.25) * 0.012;

    function rotateBone(
      requestedName: string,
      x = 0,
      y = 0,
      z = 0
    ) {
      const bone =
        bones[requestedName] ??
        Object.entries(bones).find(([name]) =>
          name.endsWith(requestedName)
        )?.[1];

      if (!bone) return;

      const base = originalRotations.get(bone);
      if (!base) return;

      bone.rotation.set(
        base.x + x,
        base.y + y,
        base.z + z,
        base.order
      );
    }

    // Head and neck: small nods and thoughtful tilts.
    rotateBone(
      "head",
      thinking ? -0.075 + headMotion * 0.025 : headMotion * 0.025,
      Math.sin(t * 0.45) * 0.065,
      thinking ? -0.065 : listening ? -0.025 : 0
    );

    rotateBone(
      "neck",
      breath + (speaking ? headMotion * 0.02 : 0),
      Math.sin(t * 0.6) * 0.025,
      thinking ? -0.025 : 0
    );

    // Very small torso movement.
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

    // Alternating gestures while speaking.
    const gesture = speaking ? 1 : thinking ? 0.16 : listening ? 0.08 : 0.04;
    const leftWave = Math.sin(t * 2);
    const rightWave = Math.sin(t * 2 + Math.PI * 0.8);

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

    rotateBone("lefthand", 0, 0, speaking ? leftWave * 0.09 : 0);
    rotateBone("righthand", 0, 0, speaking ? rightWave * 0.09 : 0);
  });

  return (
    <group ref={rootRef}>
      <group
        scale={frame.scale}
        position={[
          frame.offset.x,
          frame.offset.y,
          frame.offset.z,
        ]}
      >
        <primitive object={model} />
      </group>
    </group>
  );
}

export default function Sage3DCharacter({
  state = "idle",
  compact = false,
}: Sage3DCharacterProps) {
  const stageStyle: CSSProperties = {
    position: "relative",
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: compact ? 170 : 260,
    overflow: "hidden",
    isolation: "isolate",
    borderRadius: compact ? 12 : 18,
    background:
      "radial-gradient(ellipse at 50% 38%, rgba(126, 79, 210, 0.25), transparent 65%), linear-gradient(160deg, #1d122e, #0b0812)",
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
          position: [0, 0, 2.5],
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
