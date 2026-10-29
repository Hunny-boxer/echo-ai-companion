
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { EchoAvatarState } from "./EchoAvatar";

const MODEL_URL = "/models/sage-rigged-animated%20(2).glb";

type Sage3DCharacterProps = {
  state?: EchoAvatarState;
  compact?: boolean;
};

function normalizeClipName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function makeOpaqueMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();

  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.blending = THREE.NormalBlending;
  material.alphaTest = 0;

  // Disable glass-like transmission while retaining the material's
  // original base color, texture, roughness and metallic properties.
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.transmission = 0;
    material.thickness = 0;
  }

  // Some GLB textures contain alpha values even when the material
  // is marked opaque. Preserve their RGB color data but ignore the
  // base-color texture's alpha channel.
  const previousCompile = material.onBeforeCompile.bind(material);

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);

    shader.fragmentShader = shader.fragmentShader.replace(
      "diffuseColor *= sampledDiffuseColor;",
      "diffuseColor.rgb *= sampledDiffuseColor.rgb;"
    );
  };

  material.customProgramCacheKey = () => "echo-sage-opaque-v1";
  material.needsUpdate = true;

  return material;
}

function SageRig({
  state,
  compact,
}: {
  state: EchoAvatarState;
  compact: boolean;
}) {
  const { scene, animations } = useGLTF(MODEL_URL);

  const model = useMemo(() => {
    const copy = cloneSkeleton(scene) as THREE.Group;

    copy.traverse((object) => {
      const mesh = object as THREE.Mesh;

      if (!mesh.isMesh) return;

      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(makeOpaqueMaterial)
        : makeOpaqueMaterial(mesh.material);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    return copy;
  }, [scene]);

  const framing = useMemo(() => {
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const targetHeight = compact ? 1.42 : 1.85;
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

  useEffect(() => {
    const requested =
      state === "speaking"
        ? "TalkingGesture"
        : state === "thinking"
          ? "Thinking"
          : "Idle";

    const wanted = normalizeClipName(requested);

    const clipName =
      names.find((name) => normalizeClipName(name) === wanted) ??
      names.find((name) => normalizeClipName(name) === "idle") ??
      names[0];

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

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (!root.current) return;

    root.current.position.y = Math.sin(time * 1.15) * 0.005;
    root.current.rotation.y =
      Math.sin(time * 0.42) *
      (state === "speaking" ? 0.02 : 0.03);
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
          position: [0, compact ? 0.02 : 0.05, compact ? 2.65 : 3.2],
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

        <Suspense fallback={null}>
          <SageRig state={state} compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
