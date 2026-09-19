import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createPetalGeometry, petalPoint, PETAL_COUNT } from './petalGeometry'

// The flower and terrain are procedural. Background trees use lightweight CC0 GLB assets
// from Quaternius via jsDelivr, with a procedural fallback if the CDN is unavailable.
const TREE_ASSET_URLS = [
  'https://cdn.jsdelivr.net/gh/anshaneja5/skyline-run@main/public/assets/models/tree1.glb',
  'https://cdn.jsdelivr.net/gh/anshaneja5/skyline-run@main/public/assets/models/tree2.glb',
  'https://cdn.jsdelivr.net/gh/anshaneja5/skyline-run@main/public/assets/models/tree3.glb',
]
function makePaintTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1
    const cloud = Math.sin(x * .065 + Math.sin(y * .034) * 2) * Math.cos(y * .055)
    const pigment = 242 + cloud * 7 + grain * 3
    const k = (y * 256 + x) * 4
    data.data[k] = pigment; data.data[k + 1] = pigment; data.data[k + 2] = pigment; data.data[k + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(156,128,72,0.1)'
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(128, 0); ctx.quadraticCurveTo(78 + i * 16, 120, 108 + i * 7, 256); ctx.stroke() }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
function makeGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,249,1)')
  gradient.addColorStop(.08, 'rgba(255,251,224,.96)')
  gradient.addColorStop(.22, 'rgba(255,226,146,.44)')
  gradient.addColorStop(.6, 'rgba(255,224,150,.09)')
  gradient.addColorStop(1, 'rgba(255,232,165,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = 'rgba(255,255,240,.9)'
  ctx.beginPath(); ctx.moveTo(64, 24); ctx.quadraticCurveTo(68, 60, 92, 64); ctx.quadraticCurveTo(68, 68, 64, 104); ctx.quadraticCurveTo(60, 68, 36, 64); ctx.quadraticCurveTo(60, 60, 64, 24); ctx.fill()
  return new THREE.CanvasTexture(canvas)
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,256,128)
  const puffs = [
    [66,74,34],[96,58,42],[133,71,39],[164,62,31],[112,82,33]
  ]
  for (const [x,y,r] of puffs) {
    const g = ctx.createRadialGradient(x, y, r*0.18, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,.95)')
    g.addColorStop(.58, 'rgba(250,252,253,.88)')
    g.addColorStop(1, 'rgba(245,248,250,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill()
  }
  ctx.fillStyle='rgba(248,250,252,.78)'
  ctx.beginPath();
  ctx.moveTo(46,84)
  ctx.quadraticCurveTo(84,102,130,98)
  ctx.quadraticCurveTo(182,96,190,76)
  ctx.quadraticCurveTo(167,91,118,90)
  ctx.quadraticCurveTo(67,91,46,84)
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
function makeSunTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(128,128,8,128,128,122)
  g.addColorStop(0,'rgba(255,252,214,1)')
  g.addColorStop(.34,'rgba(255,233,126,.98)')
  g.addColorStop(.68,'rgba(255,205,74,.72)')
  g.addColorStop(1,'rgba(255,196,66,0)')
  ctx.fillStyle=g;ctx.fillRect(0,0,256,256)
  ctx.fillStyle='rgba(255,237,151,.96)'
  ctx.beginPath();ctx.arc(128,128,58,0,Math.PI*2);ctx.fill()
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  return texture
}

const V = (x,y,z) => new THREE.Vector3(x,y,z)

export default function FlowerScene({ onSelect, onFocusComplete, onStatus, paused, modalOpen, visited, focusMemoryId, nextMemoryId, resetKey, reducedMotion, debug }) {
  const host = useRef(null), live = useRef({})
  live.current = { paused, modalOpen, visited, focusMemoryId, nextMemoryId, resetKey, reducedMotion, debug, onSelect, onFocusComplete, onStatus }
  useEffect(() => {
    const container = host.current
    let disposed = false
    let renderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' }) }
    catch { live.current.onStatus?.('unsupported'); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = debug?.exposure ?? 1.0
    renderer.domElement.setAttribute('aria-label', 'Flor 3D. Arrastra para girarla o toca un punto de luz. También puedes usar los seis botones de recuerdos.')
    renderer.domElement.setAttribute('role', 'img')
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eefcff')
    scene.fog = new THREE.Fog('#d7efc9', 30, 82)
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 80); scene.add(camera)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 2.1, 0)
    controls.enableDamping = true; controls.dampingFactor = .065; controls.enablePan = false
    controls.minDistance = 3.4; controls.maxDistance = 14
    // Keep the orbit above the meadow using OrbitControls only; never clamp camera.position per frame.
    controls.minPolarAngle = .24; controls.maxPolarAngle = 1.36
    controls.rotateSpeed = .65; controls.zoomSpeed = .65
    function resetView() { camera.position.set(4.8, 5.5, 7.6); controls.target.set(0, 2.1, 0); controls.update() }
    resetView()
    const hemi = new THREE.HemisphereLight('#fff8de', '#8fbd6b', debug?.ambient ?? 2.2); scene.add(hemi)
    const sun = new THREE.DirectionalLight('#fff3c0', debug?.sun ?? 2.45)
    sun.position.set(-3, 7, 5); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -4; sun.shadow.camera.right = 4
    sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -4; sun.shadow.normalBias = .04
    sun.shadow.bias = -.0002; sun.shadow.radius = 4
    scene.add(sun)
    const rim = new THREE.DirectionalLight('#f4fff2', 1.1); rim.position.set(4, 3, -5); scene.add(rim)
    const paint = makePaintTexture(), glowTexture = makeGlowTexture()
    const paleGold = new THREE.MeshStandardMaterial({ vertexColors: true, map: paint, roughness: .93, metalness: 0 })
    const green = new THREE.MeshStandardMaterial({ color: '#718356', map: paint, roughness: 1 })
    const leafMaterial = new THREE.MeshStandardMaterial({ color: '#7b905e', map: paint, roughness: 1 })
    const brown = new THREE.MeshStandardMaterial({ color: '#997047', roughness: 1, map: paint })
    const cream = new THREE.MeshStandardMaterial({ color: '#eee4a8', roughness: .95 })
    const flower = new THREE.Group(); scene.add(flower)
    const environment = new THREE.Group(); scene.add(environment)
    const solids = [], targets = [], lamps = []
    function addMesh(geo, material, parent = flower, occluder = true) {
      const mesh = new THREE.Mesh(geo, material); mesh.castShadow = true; mesh.receiveShadow = true
      parent.add(mesh); if (occluder) solids.push(mesh); return mesh
    }
    function tube(points, radius, material, parent = flower) {
      return addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, radius, 10, false), material, parent)
    }
    tube([V(.02,.05,0),V(-.12,1,0),V(.04,2,.025),V(0,3,0)], .065, green);
    // Long, slender leaves with the same smooth closed surface as the petals.
    const leafLayouts = [[.8,.8,1.3],[1.4,3.8,1.1],[1.95,5.1,.85]]
    leafLayouts.forEach(([height,angle,length]) => {
      const leafGroup = new THREE.Group(); leafGroup.position.set(0,height,0); leafGroup.rotation.y = angle
      flower.add(leafGroup)
      const leaf = addMesh(createPetalGeometry(length,.21,40,20),leafMaterial,leafGroup)
      leaf.scale.y = .43; leaf.rotation.x = -.2
    })
    const crown = new THREE.Group(); crown.position.y = 3; flower.add(crown)
    const cup = addMesh(new THREE.SphereGeometry(.25,24,16),green,crown); cup.scale.set(1,.5,1); cup.position.y=-.015
    for(let i=0;i<PETAL_COUNT;i++) {
      const group = new THREE.Group(); group.rotation.y = i * Math.PI/3 + .13; group.position.y = i%2 ? .03 : -.025; crown.add(group)
      const length = i%2 ? 1.93 : 2.13
      addMesh(createPetalGeometry(length,i%2?.57:.62),paleGold,group)
      const tip = petalPoint(1,0,length); tip.y += .12
      const lamp = new THREE.Group(); lamp.position.copy(tip); group.add(lamp)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.039,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(1.7,1.5,1.05),toneMapped:false})); lamp.add(bulb)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}))
      halo.scale.setScalar(.72); lamp.add(halo)
      const hit = new THREE.Mesh(new THREE.SphereGeometry(.19,12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}))
      hit.userData.memoryId=i+1; lamp.add(hit); targets.push(hit)
      lamps.push({lamp,halo,bulb,index:i})
    }
    for(let i=0;i<6;i++) {
      const angle=i*Math.PI/3, tip=V(Math.sin(angle)*.31,.8+(i%2)*.14,Math.cos(angle)*.31)
      tube([V(0,.05,0),V(tip.x*.5,.45,tip.z*.5),tip],.018,cream,crown)
      const anther=addMesh(new THREE.SphereGeometry(.075,18,12),brown,crown); anther.scale.set(.7,1.7,.7); anther.position.copy(tip); anther.rotation.z=-Math.sin(angle)*.4
    }
    tube([V(0,.04,0),V(-.04,.65,0),V(-.06,1.02,.05)],.026,green,crown)
    const stigma=addMesh(new THREE.SphereGeometry(.065,18,12),leafMaterial,crown); stigma.position.set(-.06,1.02,.05); stigma.scale.y=.6

    // Lightweight garden environment: real foreground geometry + inexpensive distant layers.
    // The distant hills are deliberately simple and rely on fog for a painted, faux-3D depth effect.
    const meadowMaterial=new THREE.MeshStandardMaterial({color:'#b5de61',roughness:1,map:paint})
    const terrainHeight=(x,z)=>{const ly=-z,r=Math.hypot(x,ly);return -.22+Math.sin(x*.34)*.1+Math.cos(ly*.29)*.08+Math.sin((x+ly)*.17)*.05+Math.max(0,1-r/17.5)*.18}
    const meadowGeometry=new THREE.PlaneGeometry(144,144,96,96)
    const meadowPos=meadowGeometry.attributes.position
    for(let i=0;i<meadowPos.count;i++){
      const x=meadowPos.getX(i),ly=meadowPos.getY(i)
      meadowPos.setZ(i,terrainHeight(x,-ly))
    }
    meadowGeometry.computeVertexNormals()
    const meadow=new THREE.Mesh(meadowGeometry,meadowMaterial);meadow.rotation.x=-Math.PI/2;meadow.receiveShadow=true;environment.add(meadow)

    
    // General meadow grass: fully unlit RawShaderMaterial so flat cards cannot turn black.
    // Two crossed cards per tuft keep the grass visible from every camera angle.
    const grassGeometry=new THREE.PlaneGeometry(.12,.7,2,6)
    const grassPos=grassGeometry.attributes.position
    for(let i=0;i<grassPos.count;i++){
      const y=grassPos.getY(i)+.35
      grassPos.setY(i,y)
      const t=Math.min(1,Math.max(0,y/.7))
      const taper=1-t*.9
      grassPos.setX(i,grassPos.getX(i)*taper)
    }
    grassGeometry.computeVertexNormals()

    const grassMaterial=new THREE.RawShaderMaterial({
      side:THREE.DoubleSide,
      uniforms:{
        uTime:{value:0},
        uWindStrength:{value:1},
        uGrassBrightness:{value:1},
        uPaint:{value:paint}
      },
      vertexShader:`
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        attribute mat4 instanceMatrix;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uWindStrength;
        varying float vBladeHeight;
        varying float vVariation;
        varying vec2 vUv;
        void main(){
          vec3 p=position;
          float bladeHeight=clamp(p.y/.7,0.0,1.0);
          vec3 origin=vec3(instanceMatrix[3].x,instanceMatrix[3].y,instanceMatrix[3].z);
          float slowWave=sin(uTime*1.18+origin.x*.48+origin.z*.41);
          float quickWave=sin(uTime*2.05+origin.z*.77-origin.x*.26);
          float gust=(slowWave+quickWave*.3)*uWindStrength;
          float bend=bladeHeight*bladeHeight;
          p.x+=gust*.08*bend;
          p.z+=cos(uTime*.78+origin.x*.31+origin.z*.58)*.04*bend*uWindStrength;
          p.y+=sin(uTime*.9+origin.x*.24)*.008*bend*uWindStrength;
          vBladeHeight=bladeHeight;
          vVariation=fract(sin(dot(origin.xz,vec2(12.9898,78.233)))*43758.5453);
          vUv=uv;
          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.0);
        }
      `,
      fragmentShader:`
        precision highp float;
        uniform float uGrassBrightness;
        uniform sampler2D uPaint;
        varying float vBladeHeight;
        varying float vVariation;
        varying vec2 vUv;
        void main(){
          // Darker botanical greens, varied per tuft.
          vec3 darkGreen=vec3(.085,.22,.045);
          vec3 leafGreen=vec3(.17,.39,.075);
          vec3 freshGreen=vec3(.28,.51,.105);
          vec3 base=mix(darkGreen,leafGreen,vVariation*.82);
          vec3 c=mix(base,freshGreen,vBladeHeight*.36);

          // Reuse the same watercolor/pigment texture as the flower leaves.
          vec2 paintUv=vec2(vUv.x,fract(vUv.y*.94+vVariation*.31));
          float pigment=texture2D(uPaint,paintUv).r;
          float paperTone=mix(.80,1.06,smoothstep(.86,.98,pigment));
          c*=paperTone;

          // Subtle longitudinal vein and pigment mottling.
          float vein=1.0-smoothstep(.04,.33,abs(vUv.x-.5));
          c+=vec3(.022,.045,.009)*vein*(.25+.75*vBladeHeight);
          float mottling=sin(vUv.y*18.0+vVariation*9.0)*sin(vUv.x*10.0-vVariation*4.0);
          c*=.965+mottling*.028;

          c*=uGrassBrightness;
          c=clamp(c,vec3(.055,.15,.028),vec3(.36,.60,.16));
          gl_FragColor=vec4(c,1.0);
        }
      `,
      toneMapped:false,
      fog:false
    })
    grassMaterial.forceSinglePass=true

    const grassCount=6800
    const grassA=new THREE.InstancedMesh(grassGeometry,grassMaterial,grassCount)
    const grassB=new THREE.InstancedMesh(grassGeometry,grassMaterial,grassCount)
    const dummy=new THREE.Object3D()
    const pseudo=n=>{const x=Math.sin(n*91.733+17.17)*43758.5453;return x-Math.floor(x)}
    for(let i=0;i<grassCount;i++){
      const u=pseudo(i+1),v=pseudo(i+71),a=u*Math.PI*2
      const r=.65+Math.pow(v,.73)*34
      const gx=Math.cos(a)*r,gz=Math.sin(a)*r
      const baseY=terrainHeight(gx,gz)+.012
      const h=.68+pseudo(i+401)*1.05
      const w=.78+pseudo(i+501)*.42
      const tiltX=(pseudo(i+171)-.5)*.08
      const tiltZ=(pseudo(i+311)-.5)*.07
      const rot=a+(pseudo(i+241)-.5)*.9

      dummy.position.set(gx,baseY,gz)
      dummy.rotation.set(tiltX,rot,tiltZ)
      dummy.scale.set(w,h,w)
      dummy.updateMatrix();grassA.setMatrixAt(i,dummy.matrix)

      dummy.rotation.set(tiltX,rot+Math.PI*.5,tiltZ)
      dummy.updateMatrix();grassB.setMatrixAt(i,dummy.matrix)
    }
    grassA.instanceMatrix.needsUpdate=true;grassB.instanceMatrix.needsUpdate=true
    grassA.castShadow=false;grassA.receiveShadow=false;grassA.frustumCulled=false
    grassB.castShadow=false;grassB.receiveShadow=false;grassB.frustumCulled=false
    environment.add(grassA,grassB)

    // Removed the extra 3D grass/leaf clumps around the flower base.

    const bloomGeometry=new THREE.OctahedronGeometry(.043,0),bloomMaterial=new THREE.MeshStandardMaterial({color:'#fff2bf',roughness:.9,emissive:'#726121',emissiveIntensity:.06})
    const bloomCount=72,blooms=new THREE.InstancedMesh(bloomGeometry,bloomMaterial,bloomCount)
    for(let i=0;i<bloomCount;i++){
      const a=pseudo(i+1201)*Math.PI*2,r=1.25+Math.pow(pseudo(i+1301),.72)*6.2,x=Math.cos(a)*r,z=Math.sin(a)*r
      dummy.position.set(x,terrainHeight(x,z)+.19+pseudo(i+1401)*.13,z);dummy.rotation.set(pseudo(i+1501)*2,a,pseudo(i+1601)*2)
      const sc=.65+pseudo(i+1701)*.85;dummy.scale.setScalar(sc);dummy.updateMatrix();blooms.setMatrixAt(i,dummy.matrix)
    }
    blooms.instanceMatrix.needsUpdate=true;environment.add(blooms)

    // Removed blob-like shrub masses because they intersected the forest and read as flat green chunks.

    // Quaternius CC0 trees. Three variants are repeated with different scales/rotations,
    // producing a fuller forest while keeping the number of unique downloads tiny.
    const forest=new THREE.Group();forest.name='cc0-forest';environment.add(forest)
    const treeLoader=new GLTFLoader()
    const addFallbackForest=()=>{
      const trunkMat=new THREE.MeshStandardMaterial({color:'#6f674f',roughness:1})
      const canopyMat=new THREE.MeshStandardMaterial({color:'#6d896a',roughness:1,flatShading:true})
      for(let i=0;i<320;i++){
        const layer=Math.floor(i/80)
        const angleJitter=(pseudo(i+2101)-0.5)*0.08
        const a=i*0.29+0.35+angleJitter,r=15.5+layer*6.2+pseudo(i+2201)*6.5,x=Math.cos(a)*r,z=Math.sin(a)*r
        const tree=new THREE.Group(),h=8.8+pseudo(i+2301)*5.8;tree.position.set(x,terrainHeight(x,z),z);tree.rotation.y=a
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.18,h*.62,7),trunkMat);trunk.position.y=h*.31;tree.add(trunk)
        for(let c=0;c<4;c++){
          const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.9,1),canopyMat)
          crown.position.set((c-1.5)*.42,h*(.58+c*.085),(c%2?.2:-.14));crown.scale.set(1.25,.95,1.15);tree.add(crown)
        }
        forest.add(tree)
      }
    }
    Promise.allSettled(TREE_ASSET_URLS.map(url=>treeLoader.loadAsync(url))).then(results=>{
      if(disposed)return
      const sources=results.filter(r=>r.status==='fulfilled').map(r=>r.value.scene)
      if(!sources.length){addFallbackForest();return}
      const metrics=sources.map(source=>{
        source.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if('roughness'in m)m.roughness=Math.max(.82,m.roughness??.82)})}}})
        const box=new THREE.Box3().setFromObject(source),size=box.getSize(new THREE.Vector3())
        return {source,height:Math.max(size.y,.001),minY:box.min.y}
      })
      const treeCount=420
      for(let i=0;i<treeCount;i++){
        const metric=metrics[i%metrics.length]
        const layer=Math.floor(i/105)
        const angleJitter=(pseudo(i+2501)-0.5)*0.085
        const a=i*0.165+.18+angleJitter
        const r=16.5+layer*6.2+pseudo(i+2601)*6.4
        const x=Math.cos(a)*r,z=Math.sin(a)*r
        const tree=metric.source.clone(true),targetHeight=9.2+pseudo(i+2701)*6.8,sc=targetHeight/metric.height
        tree.scale.setScalar(sc);tree.rotation.y=a+pseudo(i+2801)*Math.PI
        tree.position.set(x,terrainHeight(x,z)-metric.minY*sc,z)
        forest.add(tree)
      }
    })

    const sky=new THREE.Mesh(new THREE.SphereGeometry(52,24,12),new THREE.MeshBasicMaterial({color:'#eafaff',side:THREE.BackSide,fog:false}))
    sky.position.y=4;environment.add(sky)
    const haze=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:'#fff7d6',transparent:true,opacity:.035,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false}))
    haze.position.set(-12,13,-28);haze.scale.set(19,19,1);environment.add(haze)

    const particleGeometry=new THREE.BufferGeometry(),particlePositions=[]
    for(let i=0;i<28;i++) particlePositions.push(Math.sin(i*4.7)*3.1,.4+(i%11)*.43,Math.cos(i*2.3)*2.6)
    particleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3))
    const particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:'#fff5c7',size:.055,map:glowTexture,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(particles)
    const burstCount=26,burstPositions=new Float32Array(burstCount*3),burstGeo=new THREE.BufferGeometry()
    burstGeo.setAttribute('position',new THREE.BufferAttribute(burstPositions,3))
    const burstMat=new THREE.PointsMaterial({map:glowTexture,color:'#fff1a7',size:.16,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})
    const burst=new THREE.Points(burstGeo,burstMat); burst.visible=false;scene.add(burst)

    const composer=new EffectComposer(renderer),renderPass=new RenderPass(scene,camera)
    const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),debug?.bloom ?? .14,.45,1.2)
    const output=new OutputPass();composer.addPass(renderPass);composer.addPass(bloom);composer.addPass(output)
    function resize(){
      const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return
      renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<.8?44:36;camera.updateProjectionMatrix()
    }
    const observer=new ResizeObserver(resize);observer.observe(container);resize()
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2()
    let hovered=null,down=null,latestReset=live.current.resetKey,latestFocus=live.current.focusMemoryId,frame=0,elapsed=0,last=performance.now()
    let cameraTween=null
    function pick(event){
      const rect=renderer.domElement.getBoundingClientRect()
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)
      raycaster.setFromCamera(pointer,camera)
      const hit=raycaster.intersectObjects([...targets,...solids],false)[0]
      const id=hit?.object.userData.memoryId??null
      if(!id) return null
      const opts=live.current
      const allowed=opts.visited.has(id)||opts.nextMemoryId===id||opts.visited.size===6
      return allowed?id:null
    }
    function move(event){hovered=live.current.modalOpen?null:pick(event);container.style.cursor=hovered?'pointer':down?'grabbing':'grab'}
    function pointerDown(event){down={x:event.clientX,y:event.clientY};move(event)}
    function pointerUp(event){
      if(!down)return
      const moved=Math.hypot(event.clientX-down.x,event.clientY-down.y);down=null
      if(moved>7||live.current.modalOpen)return
      const id=pick(event)
      if(id){ lamps[id-1].lamp.getWorldPosition(burst.position);delete burst.userData.wallStart;burst.visible=true;live.current.onSelect?.(id) }
    }
    function pointerLeave(){hovered=null;down=null;container.style.cursor='grab'}
    function focusPetal(id){
      const entry=lamps[id-1]
      if(!entry) return
      const lampPos=new THREE.Vector3(); entry.lamp.getWorldPosition(lampPos)

      // Move the camera toward the chosen petal, but keep orbiting centered on the flower.
      // This way the motion feels intentional without changing the whole navigation model.
      const fromPos=camera.position.clone()
      const fromTarget=controls.target.clone()
      const flowerCenter=new THREE.Vector3(0,2.1,0)

      const petalToCamera=fromPos.clone().sub(lampPos)
      const distanceToPetal=petalToCamera.length()
      if(distanceToPetal<1e-4) petalToCamera.set(0,1.2,4.5)
      else petalToCamera.normalize()

      const desiredDistance=Math.max(4.7,Math.min(6.2,distanceToPetal*.78))
      const desiredTarget=flowerCenter.clone().lerp(lampPos,0.18)
      const toPos=lampPos.clone().add(petalToCamera.multiplyScalar(desiredDistance))
      toPos.y=Math.max(2.55,toPos.y)

      cameraTween={
        id,
        t:0,
        fromPos,
        fromTarget,
        toPos,
        toTarget:desiredTarget,
        duration:live.current.reducedMotion ? 0.01 : 1.28
      }
    }
    function contextLost(e){e.preventDefault();live.current.onStatus?.('lost')}
    const canvas=renderer.domElement
    canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerLeave);canvas.addEventListener('pointerleave',pointerLeave);canvas.addEventListener('webglcontextlost',contextLost)
    function animate(now){
      frame=requestAnimationFrame(animate)
      const dt=Math.min((now-last)/1000,.06);last=now
      const opts=live.current,moving=!opts.paused&&!opts.reducedMotion&&!opts.modalOpen
      if(moving)elapsed+=dt
      renderer.toneMappingExposure=opts.debug?.exposure ?? 1.0
      hemi.intensity=opts.debug?.ambient ?? 2.2
      sun.intensity=opts.debug?.sun ?? 2.45
      rim.intensity=.85 + (opts.debug?.sun ?? 2.45)*0.08
      bloom.strength=opts.debug?.bloom ?? .14
      sun.shadow.radius=2 + (opts.debug?.shadows ?? .35)*6
      renderer.shadowMap.enabled=(opts.debug?.shadows ?? .35) > 0.02
      controls.enabled=!opts.modalOpen&&!cameraTween;controls.enableDamping=!opts.reducedMotion&&!cameraTween
      if(opts.resetKey!==latestReset){resetView();latestReset=opts.resetKey}
      if(opts.focusMemoryId!==latestFocus){
        latestFocus=opts.focusMemoryId
        if(latestFocus) focusPetal(latestFocus)
      }
      if(cameraTween){
        cameraTween.t=Math.min(1,cameraTween.t+dt/cameraTween.duration)
        const e = cameraTween.t < 0.5 ? 4 * cameraTween.t * cameraTween.t * cameraTween.t : 1 - Math.pow(-2 * cameraTween.t + 2, 3) / 2
        camera.position.lerpVectors(cameraTween.fromPos,cameraTween.toPos,e)
        controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,e)
        if(cameraTween.t>=1){
          const completedId=cameraTween.id
          cameraTween=null
          controls.enableDamping=!opts.reducedMotion
          live.current.onFocusComplete?.(completedId)
        }
      }
      if(moving){
        flower.rotation.z=Math.sin(elapsed*.65)*.017
        flower.rotation.x=Math.cos(elapsed*.51)*.008
        particles.rotation.y=elapsed*.012
      }
      grassMaterial.uniforms.uTime.value=elapsed;grassMaterial.uniforms.uWindStrength.value=moving?1:0;grassMaterial.uniforms.uGrassBrightness.value=opts.debug?.grass ?? 1
      for(const {halo,bulb,index} of lamps){
        const id=index+1
        const seen = opts.visited.has(id)
        const isNext = opts.nextMemoryId === id && opts.visited.size < 6
        const active = hovered === id
        const pulse = moving ? Math.sin(elapsed * 2.2 + index) * 0.05 : 0
        const guidePulse = isNext ? Math.max(0, Math.sin(elapsed * 2.5)) * 0.16 : 0
        const haloBase = isNext ? 1.12 : (seen ? 0.64 : 0.26)
        halo.scale.setScalar(haloBase + pulse + guidePulse + (active ? 0.08 : 0))
        halo.material.opacity = isNext ? 1.0 : (seen ? 0.54 : (active ? 0.22 : 0.1))
        bulb.scale.setScalar(isNext ? 1.26 + (active ? 0.08 : 0) : (seen ? 1.04 : (active ? 0.9 : 0.76)))
        if(bulb.material?.color){
          if(isNext) bulb.material.color.setRGB(2.7,2.18,1.22)
          else if(seen) bulb.material.color.setRGB(1.28,1.08,0.78)
          else bulb.material.color.setRGB(0.34,0.32,0.28)
        }
      }
      if(burst.visible){
        const age=(now/1000)-(burst.userData.wallStart??now/1000)
        if(burst.userData.wallStart===undefined)burst.userData.wallStart=now/1000
        if(age>1.2||opts.reducedMotion){burst.visible=false;delete burst.userData.wallStart}
        else {for(let i=0;i<burstCount;i++){const a=i*2.399,r=age*(.3+(i%4)*.09);burstPositions[i*3]=Math.cos(a)*r;burstPositions[i*3+1]=age*.3+Math.sin(i*3)*r*.5;burstPositions[i*3+2]=Math.sin(a)*r}burstGeo.attributes.position.needsUpdate=true;burstMat.opacity=1-age/1.2}
      }
      controls.update();composer.render()
    }
    try {composer.render();live.current.onStatus?.('ready');frame=requestAnimationFrame(animate)}catch{live.current.onStatus?.('unsupported')}
    return ()=>{
      disposed=true
      cancelAnimationFrame(frame);observer.disconnect();controls.dispose()
      canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerLeave);canvas.removeEventListener('pointerleave',pointerLeave);canvas.removeEventListener('webglcontextlost',contextLost)
      const geometries=new Set(),materials=new Set()
      scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))})
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());paint.dispose();glowTexture.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();canvas.remove()
    }
  },[])
  return <div className="scene" ref={host}/>
}
