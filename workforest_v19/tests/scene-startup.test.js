import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as THREE from 'three'
import * as petal from '../src/petalGeometry.js'

// Execute the actual effect and geometry code with just the browser/GPU
// interfaces replaced. This verifies initialization, not WebGL appearance.
test('scene initializes, renders an animation frame and cleans up',()=>{
  const source=readFileSync(new URL('../src/FlowerScene.jsx',import.meta.url),'utf8')
    .replace(/^import .*$/gm,'')
    .replace('export default function FlowerScene','function FlowerScene')
    .replace('return <div className="scene" ref={host}/>','return null')
  const effects=[],statuses=[],callbacks=new Map(),children=[]
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){},fill(){},fillRect(){},createRadialGradient:()=>({addColorStop(){}})}
  const canvas=()=>({getContext:()=>ctx,setAttribute(){},addEventListener(){},removeEventListener(){},remove(){children.pop()}})
  const host={clientWidth:1000,clientHeight:800,appendChild:c=>children.push(c),style:{}}
  let renders=0,disposed=false
  class Renderer{domElement=canvas();shadowMap={};setPixelRatio(){}setClearColor(){}setSize(){}dispose(){disposed=true}}
  class Controls{target=new THREE.Vector3();update(){}dispose(){}}
  class Composer{addPass(){}setSize(){}render(){renders++}dispose(){}}
  class Pass{dispose(){}}
  const context={...petal,THREE:{...THREE,WebGLRenderer:Renderer},OrbitControls:Controls,EffectComposer:Composer,RenderPass:Pass,UnrealBloomPass:Pass,OutputPass:Pass,GLTFLoader:class{loadAsync(){return Promise.reject(new Error('offline test'))}},
    useRef:value=>({current:value===null?host:value}),useEffect:fn=>effects.push(fn),
    document:{createElement:()=>canvas()},window:{devicePixelRatio:1},performance:{now:()=>0},
    ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=callbacks.size+1;callbacks.set(id,fn);return id},cancelAnimationFrame:id=>callbacks.delete(id)}
  vm.createContext(context)
  vm.runInContext(source+'\nthis.Component=FlowerScene;',context)
  context.Component({onSelect(){},onStatus:s=>statuses.push(s),paused:false,modalOpen:false,visited:new Set(),resetKey:0,reducedMotion:false})
  const dispose=effects[0]()
  assert.deepEqual(statuses,['ready'])
  assert.equal(children.length,1)
  callbacks.get(1)(16)
  assert.equal(renders,2)
  dispose()
  assert.equal(disposed,true)
  assert.equal(children.length,0)
})
