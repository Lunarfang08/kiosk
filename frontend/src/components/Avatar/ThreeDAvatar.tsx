import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'
import { avatarAssetUrl } from '@/services/avatarService'
import { useAvatarEngineVisuals } from '@/hooks/useAvatarEngine'

function Model({ url, mouthOpen }: { url: string; mouthOpen: number }) {
  const { scene } = useGLTF(url)
  const ref = useRef<Group>(null)
  const [hasMorphs, setHasMorphs] = useState(true)

  const morphMeshes = useMemo(() => {
    const meshes: { mesh: Mesh; index: number }[] = []
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      const dict = mesh.morphTargetDictionary
      const influences = mesh.morphTargetInfluences
      if (dict && influences) {
        const jaw =
          dict.jawOpen ??
          dict.mouthOpen ??
          dict.viseme_aa ??
          dict.A ??
          Object.values(dict)[0]
        if (typeof jaw === 'number') meshes.push({ mesh, index: jaw })
      }
    })
    return meshes
  }, [scene])

  useEffect(() => {
    setHasMorphs(morphMeshes.length > 0)
  }, [morphMeshes])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.05
    }
    for (const { mesh, index } of morphMeshes) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[index] = mouthOpen
      }
    }
  })

  return (
    <group ref={ref}>
      <primitive object={scene} />
      {!hasMorphs && null}
    </group>
  )
}

export function ThreeDAvatar() {
  const { avatar, mouthOpen, speaking } = useAvatarEngineVisuals()
  const url = avatarAssetUrl(avatar?.model_path)
  const [morphWarning, setMorphWarning] = useState(false)

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-[var(--color-muted)]">
        Upload a GLB/GLTF/VRM model in Avatar Studio. Models without facial morph targets
        cannot provide realistic lip-sync.
      </div>
    )
  }

  return (
    <div className="relative h-[72vh] w-full max-w-[75vw]">
      <Canvas camera={{ position: [0, 1.4, 2.2], fov: 35 }}>
        <color attach="background" args={[avatar?.background || '#0a0c10']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} />
        <Suspense fallback={null}>
          <Model url={url} mouthOpen={speaking ? mouthOpen : 0} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.2} maxDistance={3.5} />
      </Canvas>
      <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
        3D avatar · requires facial morph targets for lip-sync
        {morphWarning ? ' · this model may lack morph targets' : ''}
      </p>
      {/* morphWarning reserved for future mesh introspection UI */}
      <button type="button" className="hidden" onClick={() => setMorphWarning(true)} />
    </div>
  )
}
