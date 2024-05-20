import logo from './logo.svg';
import './App.css';
import {Canvas, useFrame, useThree, extend, useLoader} from '@react-three/fiber';
import { useRef, Suspense, useEffect, useState, useMemo, useTransition, startTransition } from 'react';
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EXRLoader, FBXLoader, RGBELoader } from 'three/examples/jsm/Addons';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader'
import { Environment, Stage, useCubeTexture, SpotLight, Stats, Reflector } from '@react-three/drei';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import {Physics, useBox} from '@react-three/cannon'
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette, ToneMapping, SSAO, SMAA, HueSaturation, ChromaticAberration } from '@react-three/postprocessing'
import {BlendFunction} from 'postprocessing'
import {useControls} from 'leva'
import { 
  MeshReflectorMaterial, 
  MeshRefractionMaterial, 
  AccumulativeShadows, 
  Caustics ,
  MeshTransmissionMaterial,
  RandomizedLight,
} from '@react-three/drei';
extend({OrbitControls, DragControls})

const BoudingBox = ({
  position = [0,0,0],
  offset=[0,0,0],
  dims=[1,1,1],
  visible=false,
  children
}) => {
  const [ref, api] = useBox(() => ({mass:1, args: dims, position:position}))
  return(
    <group ref={ref} api={api}>
      <mesh scale={dims} visible={visible}>
        <primitive object={new THREE.BoxGeometry(1, 1, 1)} />
        <meshPhysicalMaterial wireframe/>
      </mesh>
      <group position={offset}>
        {children}
      </group>
    </group>
    
  )
}

const RefractionCup = props => {
  const {
    distortion, 
    color, 
    thickness, 
    anisotropy,
    transmission,
    chromaticAberration,
    ior
  } = useControls('Cup', {
    distortion:{
      min:0, max:1, value:0.6, step:0.01
    },
    color:{
      value:'#d1d1d1'
    },
    thickness:{
      min:0, max:1, value:0.7, step:0.01
    },
    anisotropy:{
      min:0, max:1, value:1, step:0.01
    },
    transmission:{
      min:0, max:1, value:1, step:0.01
    },
    chromaticAberration:{
      min:0, max:1, value:0.03, step:0.01
    },

  })
  const {nodes, scene} = useLoader(GLTFLoader, props.path)

  scene.traverse(child => {
    if(child.isMesh)
      {
        child.castShadow = true
        child.receiveShadow = true
        child.material.side = THREE.DoubleSide
      }
  })

  return(
      <mesh 
        castShadow 
        receiveShadow 
        geometry={nodes.cup.geometry} 
        position={[0.22,0.38,0.35]} 
        {...props}
        >
        <MeshTransmissionMaterial 
          transmissionSampler
          transmission={transmission}
          roughness={0.15}
          metalness={0.1}
          chromaticAberration={chromaticAberration}
          resolution={1024} 
          distortion={distortion} 
          color={color} 
          thickness={thickness} 
          anisotropy={anisotropy}
          anisotropicBlur={0.0}
        />
      </mesh>
  )
}


const Cup = props => {
  
  const model = useLoader(GLTFLoader, props.path)

  model.scene.traverse(child => {
    if(child.isMesh)
      {
        child.castShadow = true
        child.receiveShadow = true
        child.material.side = THREE.FrontSide
      }
  })

  return(
    <primitive 
      object={model.scene}
      scale={props.scale}
      position={[0,-0.2,0.5]}
      castShadow
      receiveShadow
    />
  )
}

const Model = props =>{
  const model = useLoader(GLTFLoader, props.path)

  model.scene.traverse(child => {
    if(child.isMesh)
      {
        child.castShadow = true
        child.receiveShadow = true
        child.material.side = THREE.FrontSide
      }
  })

  return(
    <primitive 
      object={model.scene}
      scale={props.scale}
      position={[0,-0.2,0.5]}
      castShadow
      receiveShadow
    />
  )
}

const Orbit =() => {
  const {camera, gl} = useThree();
  return(
    // <orbitControls attach='orbitControls' args={[camera, gl.domElement]}/>
    <orbitControls attach='orbitControls' args={[camera, gl.domElement]}/>
  )
}

const Dragable = props => {
  const groupRef = useRef();
  const controlsRef = useRef();
  const [children, setChildren] = useState([])
  const {camera, gl, scene} = useThree();
  useEffect(()=> {
    setChildren(groupRef.current.children)
  }, [])

  useEffect(() => {
    controlsRef.current.addEventListener('hoveron', 
      e => scene.orbitControls.enabled = false
    )
    controlsRef.current.addEventListener('hoveroff', 
      e => scene.orbitControls.enabled = true
    )
    controlsRef.current.addEventListener('dragstart', 
      e => e.object.api?.mass.set(0)
    )
    controlsRef.current.addEventListener('dragend', 
      e => e.object.api?.mass.set(1)
    )
    controlsRef.current.addEventListener('drag', 
    e => {
      e.object.api?.position.copy(e.object.position)
      e.object.api?.velocity.set(0,0,0)
    }
    )
  }, [children])
  return(
    <group ref={groupRef}>
      <dragControls 
        transformGroup={props.transformGroup}
        ref={controlsRef}
        args={[children, camera, gl.domElement]}
      />
      {props.children}
    </group>
  )
}

const Box = props =>
{
  const [ref, api] = useBox(() => ({mass:1, ...props})); 
  // const ref = useRef();
  const texture = useLoader(
    THREE.TextureLoader, 
    process.env.PUBLIC_URL + '/roof_tile_base_color.png'
  );
  // useFrame(state => {
  //   ref.current.rotation.x += 0.005;
  //   ref.current.rotation.y += 0.005;
  // })

  const handlePointerDown = e => {
    e.object.active = true;
    if(window.activeMesh)
    {
      scaleDown(window.activeMesh)
      window.activeMesh.active = false;
    }
    window.activeMesh = e.object;

  }

  const handlePointerEnter = e => {
    e.object.scale.x = 1
    e.object.scale.y = 1
    e.object.scale.z = 1
  }

  const handlePointerLeave = e => {
    if(!e.object.active)
    {
      scaleDown(e.object)
    }
    
  }

  const scaleDown = object => {
    object.scale.x = 1
    object.scale.y = 1
    object.scale.z = 1
  }

  return(
    <mesh 
    ref={ref} 
    api={api}
    {...props} 
    castShadow 
    receiveShadow
    onPointerDown={handlePointerDown}
    onPointerEnter={handlePointerEnter}
    onPointerLeave={handlePointerLeave}
    >
      <primitive object={new THREE.BoxGeometry(1, 1, 1)} />
      <meshPhysicalMaterial 
      map={texture}
      opacity={0.5}
      roughness={0}
      clearcoat={1}
      emissive="white"
      />
    </mesh>
  )
    
}

const Floor = props => {
  const {strength, blur, distortion} = useControls('Floor', {
    strength:{
      min:0, max:1, value:1, step:0.01
    },
    blur:{
      x:400,y:400
    },
    distortion:{
      min:0, max:1, value:0.1, step:0.01
    }
      
  })

  const distortTexture = useLoader(
    THREE.TextureLoader, 
    process.env.PUBLIC_URL + '/distort.png'
  );

  return(
    // <mesh ref={ref} {...props} receiveShadow castShadow>
    <mesh {...props} receiveShadow>
      <primitive object={new THREE.PlaneGeometry(100, 100)} />
      <MeshReflectorMaterial 
        blur={blur}
        resolution={1024}
        mixBlur={1}
        mixStrength={strength}
        depthScale={1}
        minDepthThreshold={0.85}
        color="grey"
        metalness={0.25}
        roughness={0.45}
        distortion={distortion}
        distortionMap={distortTexture}
      />
    </mesh>
  )
}

const MoveingSpotLight = props => {
  return(
    <spotLight
        angle={props.angle}
        intensity={props.intensity} 
        penumbra={1}
        color={props.color}
        castShadow
        shadow-mapSize-height={2**11}
        shadow-mapSize-width={2**11}
        shadow-radius={10}
        decay={1}
      />
  )
}

const Bulb = props => {
  
  return(
    <mesh {...props}>
      <MoveingSpotLight {...props}/>
      <primitive object={new THREE.SphereGeometry(0.1, 32, 16)} color={props.color}/>
      <meshPhongMaterial color={props.color}/>
    </mesh>
  )
}

const Background = props => {
  const {rotationAngle, setRotationAngle} = useState();
  const {envIntensity, blur, bgIntensity, rotation} = useControls('Environment',{
    envIntensity:{
      min:0,
      max:10,
      value:1,
      step:0.1
    },
    blur:{
      min:0,
      max:1,
      value:0,
      step:0.01
    },
    bgIntensity:{
      min:0,
      max:1,
      value:0.35,
      step:0.01
    },
    rotation:{
      min:-Math.PI,
      max:Math.PI,
      value:-1.23,
      step:0.01
    }
  })

  const texture = useLoader(RGBELoader, process.env.PUBLIC_URL + '/poly_haven_studio_2k.hdr')
  return(
    <Environment 
    background={true} 
    // files={['industrial_room.exr']} 
    // path={process.env.PUBLIC_URL + '/'}
    environmentIntensity={envIntensity}
    backgroundBlurriness={blur}
    backgroundIntensity={bgIntensity}
    >
      <color attach="background" args={['black']} />
      <mesh rotation={[0, rotation, 0]} scale={100}>
        <sphereGeometry />
        <meshBasicMaterial transparent opacity={bgIntensity} map={texture} side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </Environment>
  )
}

const ColorPicker = props => {
  const handleClick = e => {
    if(!window.activeMesh) return;

    window.activeMesh.material.color = new THREE.Color(e.target.style.background);
  }
  return (
    <div style={{position:'absolute', zIndex:1}}>
      <div 
      onClick={handleClick}
      style={{background:'blue', height:50, width:50}}>

      </div>
      <div 
      onClick={handleClick}
      style={{background:'yellow', height:50, width:50}}>

      </div>
      <div 
      onClick={handleClick}
      style={{background:'white', height:50, width:50}}>

      </div>
    </div>
  )
}

const state = {
  activeMesh: null,
  cameraPos: new THREE.Vector3(2,2,2),
  target:new THREE.Vector3(0,0,0),
  shouldUpdate:false
}

const CameraControls = ({}) => {
  useFrame(({camera, scene}) => {
    if(state.shouldUpdate)
    {
      scene.orbitControls.saveState()
      camera.position.lerp(state.cameraPos, 0.025)
      scene.orbitControls.target.lerp(state.target, 0.025)
      scene.orbitControls.update()
      const diff = camera.position.clone().sub(state.cameraPos).length()
      if(diff < 0.1)
      {
        state.shouldUpdate = false;
        // scene.orbitControls.target.set([0,0,0])
        scene.orbitControls.reset()
      } 
    }
    
  })
  return(
    null
  )
}

const style ={
  zIndex:1,
  position:'absolute',
  bottom: '10vh',
  // left: '40vh',
  height:'30px',
  width:'30px',
  background:'white',
  textAlign:'center',
  borderRadius:'100%',
  fontWeight:'bold',
  opacity:0.7,
  border:'1px solid black',
  cursor:'pointer'
}

const CameraButtons = ({}) => {
  const sets = {
    1:{
      cameraPos: [2,1.5,2],
      target:[0.1,0.5,-0.1]
    },
    2:{
      cameraPos:[-2,1.5,2],
      target:[-0.1,0.5,-0.1]
    }
  }
  const handleClick = num => {
    state.cameraPos.set(...sets[num].cameraPos)
    state.target.set(...sets[num].target)
    state.shouldUpdate = true
  }
  return (
    <>
      <button
        onClick={e => handleClick(2)}
        style={{
          left:'40vw',
          ...style
        }}
      >
        {'<'}
      </button>
      <button
      onClick={e => handleClick(1)}
      style={{
        right: '40vh',
        ...style
      }}
      >
        {'>'}
      </button>
    </>
    
  )
}

function App() {
  const {luminanceThreshold, luminanceSmoothing, opacity} = useControls('Bloom', {
    opacity:{
      min:0,
      max:1,
      value:0.1,
      step:0.01
    }
  });
  const { 
    middleGrey, 
    maxLuminance,
    avgLuminance,
   } = useControls('ToneMapping', {
    middleGrey: {
      min: 0,
      max: 1,
      value: 0.8,
      step: 0.1
    },
    maxLuminance: {
      min: 0,
      max: 64,
      value: 16,
      step: 1
    },
    avgLuminance: {
      min: 0,
      max: 5,
      value: 1,
      step: 0.1
    }
  });
  const {
    spotLightColor1, 
    intensity1, 
    target1,
    power1,
    penumbra1,
    angle1,
    spotLightColor2, 
    intensity2,
    target2,
    power2,
    penumbra2,
    angle2,
    ambientLightIntensity
    } = useControls('Light', {
    spotLightColor1:{
      value:'#ffffffff'
    },
    intensity1:{
      min:0, max:50,value:5, step:0.1
    },
    angle1:{
      min:0,max:Math.PI/2,value:Math.PI/3,step:0.01
    },
    spotLightColor2:{
      value:'#ffefe9'
    },
    intensity2:{
      min:0, max:50,value:40, step:0.1
    },
    angle2:{
      min:0,max:Math.PI/2,value:0.3,step:0.01
    },
    ambientLightIntensity:{
      min:0, max:10, value:1, step:0.1
    }
  })
  return (
    <div style={{height:"100vh",width:"100vw"}}>
      {/* <ColorPicker/> */}
      <CameraButtons/>
      <Canvas 
        camera={{fov:45}}
        shadows={true}
      >
        <CameraControls/>
        <Orbit/>
        {/* <axesHelper args={[5]}/> */}

        <RefractionCup 
            path={process.env.PUBLIC_URL + '/cup.gltf'}
            scale={new Array(3).fill(0.09)}
          />

          {/* <Suspense fallback={null}> */}
          <Model 
            path={process.env.PUBLIC_URL + '/coffemachine.gltf'}
            scale={new Array(3).fill(5)}
          />
        {/* </Suspense> */}

        <ambientLight intensity={ambientLightIntensity}/>
        {/* <directionalLight 
          position={[6,6,6]}
          intensity={2}
          castShadow
          shadow-mapSize-height={2**11}
          shadow-mapSize-width={2**11}
          shadow-radius={10}
        /> */}
        <Bulb 
          position={[-2, 4, -2]} 
          color={spotLightColor1} 
          intensity={intensity1}
          angle={angle1}
        />
        
        <Bulb 
          position={[3, 2, 1]} 
          color={spotLightColor2} 
          intensity={intensity2}
          angle={angle2}
        />
        <Background/>
        <Floor position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}/>
        
        
        {/* <Suspense fallback={null}> */}
          {/* <Cup 
            path=process.env.PUBLIC_URL + '/cup.gltf'
            scale={new Array(3).fill(5)}
          /> */}

          
        {/* </Suspense> */}

        <EffectComposer 
          enableNormalPass
         >
          <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
          <Bloom 
            luminanceThreshold={0}
            luminanceSmoothing={0.9}
            opacity={opacity} 
            />
          <Vignette eskil={false} offset={0.1} darkness={0.75} />
          <ToneMapping
            blendFunction={BlendFunction.NORMAL} 
            adaptive={false} 
            resolution={1024} 
            middleGrey={middleGrey} 
            maxLuminance={maxLuminance} 
            averageLuminance={avgLuminance} 
            // adaptationRate={1.0} 
          />
           {/* <SSAO
            blendFunction={BlendFunction.MULTIPLY} 
            samples={61} 
            rings={4}
            distanceThreshold={0}
            distanceFalloff={1} 
            rangeThreshold={0.1}
            rangeFalloff={0.1}
            luminanceInfluence={0.9}
            radius={50}
            scale={2}
            bias={0.5}
          /> */}
          {/* <SMAA/> */}
          {/* <HueSaturation
            blendFunction={BlendFunction.NORMAL}
            hue={0}
            saturation={0.1}
          /> */}
        </EffectComposer>
        
        {/* <fog attach='fog' args={['grey', 1, 20]}/> */}
        <Stats/>
      </Canvas>
    </div>
  );
}

export default App;
