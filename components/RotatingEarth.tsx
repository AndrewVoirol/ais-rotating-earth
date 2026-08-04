import React, { useRef, useMemo, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

// --- Configuration ---
const CONFIG = {
  rotationSpeed: 0.003, 
  dotDensity: 110.0,    
  dotSize: 0.14,        
  // Colors
  landColor: new THREE.Color("#ffffff"),
  coastColor: new THREE.Color("#ffffff"), 
  graticuleColor: new THREE.Color("#888888"), 
  atmosphereColor: new THREE.Color("#ffffff"),
};

// --- Custom Shaders ---

// 1. Earth Shader
const EarthMaterial = {
  uniforms: {
    uTexture: { value: null },
    uDensity: { value: CONFIG.dotDensity },
    uDotSize: { value: CONFIG.dotSize },
    uColor: { value: CONFIG.landColor },
    uCoastColor: { value: CONFIG.coastColor },
    // Default to 2K, but this will be updated dynamically
    uTexelSize: { value: new THREE.Vector2(1.0 / 2048.0, 1.0 / 1024.0) } 
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uDensity;
    uniform float uDotSize;
    uniform vec3 uColor;
    uniform vec3 uCoastColor;
    uniform vec2 uTexelSize;
    
    varying vec2 vUv;

    void main() {
      // Sample the texture (0=Ocean, 1=Land)
      float mask = texture2D(uTexture, vUv).r;
      
      // --- Coastline (Edge Detection) ---
      // Dynamic epsilon based on texture resolution for crisp lines at any res
      vec2 eps = uTexelSize * 1.5; 
      
      // Sample neighbors
      float n = texture2D(uTexture, vUv + vec2(0.0, eps.y)).r;
      float s = texture2D(uTexture, vUv - vec2(0.0, eps.y)).r;
      float e = texture2D(uTexture, vUv + vec2(eps.x, 0.0)).r;
      float w = texture2D(uTexture, vUv - vec2(eps.x, 0.0)).r;
      
      // Calculate rate of change
      float edge = abs(n - mask) + abs(s - mask) + abs(e - mask) + abs(w - mask);
      
      // Apply a threshold to ignore JPEG compression artifacts (noise reduction)
      // Only signal a coast if the edge is strong enough
      float isCoast = smoothstep(0.2, 0.6, edge);

      // --- Dot Pattern ---
      vec2 grid = fract(vUv * uDensity);
      float dist = distance(grid, vec2(0.5));
      float isDot = 1.0 - smoothstep(uDotSize, uDotSize + 0.05, dist);
      
      // --- Composition ---
      float isLand = smoothstep(0.5, 0.6, mask);
      
      // Visibility Logic:
      // 1. Coastlines are always visible
      // 2. Dots are visible ONLY on land
      float visibility = max(isCoast, isLand * isDot);
      
      // Mix colors (Coastline gets priority)
      vec3 finalColor = mix(uColor, uCoastColor, isCoast);
      
      // Discard transparent pixels
      if (visibility < 0.1) discard; 
      
      gl_FragColor = vec4(finalColor, visibility);
    }
  `,
};

// 2. Atmosphere Shader
const AtmosphereMaterial = {
  uniforms: {
    uColor: { value: CONFIG.atmosphereColor },
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying vec3 vNormal;
    void main() {
      float viewDot = dot(vNormal, vec3(0.0, 0.0, 1.0));
      float intensity = pow(max(0.0, 0.5 - viewDot), 6.0); // Sharper falloff
      gl_FragColor = vec4(uColor, intensity * 2.5);
    }
  `,
};

// --- Components ---

const Globe = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const texture = useTexture("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg");

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(EarthMaterial.uniforms),
      vertexShader: EarthMaterial.vertexShader,
      fragmentShader: EarthMaterial.fragmentShader,
      transparent: true,
      side: THREE.FrontSide, 
    });
    mat.uniforms.uTexture.value = texture;
    return mat;
  }, [texture]);

  useEffect(() => {
    if (texture.image && meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTexelSize.value.set(
        1.0 / texture.image.width, 
        1.0 / texture.image.height
      );
    }
  }, [texture]);

  return (
    <mesh ref={meshRef} scale={2}>
      <sphereGeometry args={[1, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Graticule = () => {
  return (
    <mesh scale={2.002}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={CONFIG.graticuleColor}
        wireframe={true}
        transparent={true}
        opacity={0.08} 
      />
    </mesh>
  );
};

const Atmosphere = () => {
  return (
    <mesh scale={2.15}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        uniforms={THREE.UniformsUtils.clone(AtmosphereMaterial.uniforms)}
        vertexShader={AtmosphereMaterial.vertexShader}
        fragmentShader={AtmosphereMaterial.fragmentShader}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
};

const OcclusionSphere = () => {
  return (
    <mesh scale={1.99}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  );
}

const Scene = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * CONFIG.rotationSpeed;
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, 0.2]}>
      <Globe />
      <Graticule />
      <OcclusionSphere />
    </group>
  );
}

export default function RotatingEarth({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full h-full min-h-[500px] ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 45 }}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.5} />
        
        <Suspense fallback={null}>
          <Scene />
          <Atmosphere /> 
        </Suspense>
        
        <OrbitControls 
          enablePan={false}
          enableZoom={true}
          minDistance={3.5}
          maxDistance={12}
          zoomSpeed={0.8}
          rotateSpeed={0.3}
          dampingFactor={0.05}
          enableDamping={true}
        />
      </Canvas>
      
      <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none z-10">
        <div className="inline-flex items-center gap-4 px-4 py-2">
          <p className="text-[10px] text-white/30 tracking-[0.3em] uppercase font-mono">
            Interactive WebGL System
          </p>
        </div>
      </div>
    </div>
  );
}