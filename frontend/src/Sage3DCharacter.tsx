import { Suspense, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { EchoAvatarState } from "./EchoAvatar";

const ANIMATED_MODEL_URL = "/models/sage-rigged-animated%20(2).glb";
const ORIGINAL_MODEL_URL = "/models/sage-rigged.glb";

type Sage3DCharacterProps = {
  state?: EchoAvatarState;
  compact?: boolean;
};

function normalizeClipName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function SageRig({
  state,
  compact,
}: {
  state: EchoAvatarState;
  compact: boolean;
}) {
  const { scene: animatedScene, animations } = useGLTF(ANIMATED_MODEL_URL);
  const { scene: originalScene } = useGLTF(ORIGINAL_MODEL_URL);

  const model = useMemo(() => {
    // Retain the animated GLB's skeleton and meshes.
    const copy = cloneSkeleton(animatedScene) as THREE.Group;
    const originalMeshes: THREE.Mesh[] = [];
    const originalsByName = new Map<string, THREE.Mesh[]>();

    // Collect the original, fully textured model's meshes.
    originalScene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      originalMeshes.push(mesh);

      const matches = originalsByName.get(mesh.name) ?? [];
      matches.push(mesh);
      originalsByName.set(mesh.name, matches);
    });

    // Restore original materials without discarding the animated skeleton.
    let meshIndex = 0;

    copy.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      const matches = originalsByName.get(mesh.name);
      const source = matches?.shift() ?? originalMeshes[meshIndex];

      meshIndex += 1;

      const cloneMaterial = (material: THREE.Material) => {
        const cloned = material.clone();

        // Retain the source material's real color, texture and opacity.
        if (cloned instanceof THREE.MeshStandardMaterial) {
          cloned.needsUpdate = true;
        }

        return cloned;
      };

      if (source) {
        mesh.material = Array.isArray(source.material)
          ? source.material.map(cloneMaterial)
          : cloneMaterial(source.material);
      } else {
        // Fallback for any mesh without a matching source mesh.
        const originalMaterial = mesh.material;

        mesh.material = Array.isArray(originalMaterial)
          ? originalMaterial.map(cloneMaterial)
          : cloneMaterial(originalMaterial);
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    return copy;
  }, [animatedScene, originalScene]);

  const framing = useMemo(() => {
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    // Fit to actual height instead of scaling by width/depth.
    const targetHeight = compact ? 1.18 : 1.85;
    const scale = targetHeight / Math.max(size.y, 0.001);

    return {
      scale,
      position: new THREE.Vector3(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      ),
    };
  }, [model, compact]);

  const { actions, names } = useAnimations(animations, model);

  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const root = useRef<THREE.Group | null>(null);

  // Play the appropriate embedded skeletal animation.
  useEffect(() => {
    const requested =
      state === "speaking"
        ? "TalkingGesture"
        : state === "thinking"
          ? "Thinking"
          : "Idle";

    const requestedName = normalizeClipName(requested);

    const matchedName =
      names.find(
        (name) => normalizeClipName(name) === requestedName
      ) ??
      names.find(
        (name) => normalizeClipName(name) === "idle"
      ) ??
      names[0];

    const next = matchedName ? actions[matchedName] : undefined;

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
  }, [actions, names, state]);

  useEffect(() => {
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
      activeAction.current = null;
    };
  }, [actions]);

  // Subtle movement layered on top of the skeletal animation.
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (!root.current) return;

    root.current.rotation.y =
      Math.sin(time * 0.42) *
      (state === "speaking" ? 0.018 : 0.028);

    root.current.position.y =
      (compact ? -0.1 : 0) + Math.sin(time * 1.15) * 0.004;
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
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.88, 0.008, 8, 96]} />
        <meshBasicMaterial
          color="#58f5ff"
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.006, 8, 80]} />
        <meshBasicMaterial
          color="#ad91ff"
          transparent
          opacity={0.75}
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
      : "radial-gradient(ellipse at 50% 38%, rgba(126,79,210,.19), transparent 65%), linear-gradient(160deg,#1d122e,#0b0812)",
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
          position: [0, compact ? 0.02 : 0.05, compact ? 3.05 : 3.2],
          fov: compact ? 32 : 36,
          near: 0.01,
          far: 100,
        }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.85} />

        <directionalLight
          position={[2, 3, 4]}
          intensity={1.45}
          color="#fff5ff"
        />

        <directionalLight
          position={[-3, 1, -2]}
          intensity={1.1}
          color="#6c8fff"
        />

        <pointLight
          position={[0, 1, 1.5]}
          intensity={0.55}
          color="#9b7aff"
        />

        {!compact && <HologramPlatform />}

        <Suspense fallback={null}>
          <SageRig state={state} compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(ANIMATED_MODEL_URL);
useGLTF.preload(ORIGINAL_MODEL_URL);
