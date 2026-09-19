import test from 'node:test'
import assert from 'node:assert/strict'
import { createPetalGeometry, petalPoint, PETAL_COUNT } from '../src/petalGeometry.js'
import { recuerdos } from '../src/recuerdos.js'
import * as THREE from 'three'

test('six independent, editable memories',()=>{
  assert.equal(recuerdos.length,PETAL_COUNT)
  assert.deepEqual(recuerdos.map(m=>m.id),[1,2,3,4,5,6])
  recuerdos.forEach(m=>{assert.equal(typeof m.foto,'string');assert.equal(typeof m.texto,'string');assert.ok(m.titulo.length)})
})
test('petals have finite vertices, valid indices, UVs and smooth normals',()=>{
  for(const length of [1.93,2.13]){
    const g=createPetalGeometry(length),pos=g.attributes.position,normal=g.attributes.normal
    assert.equal(pos.count,g.attributes.uv.count)
    for(const attr of Object.values(g.attributes))for(const x of attr.array)assert.ok(Number.isFinite(x))
    for(const index of g.index.array)assert.ok(index>=0&&index<pos.count)
    for(let i=33;i<pos.count-33;i++){const n=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));assert.ok(Math.abs(n-1)<.001)}
    assert.ok(g.boundingSphere.radius>1)
    g.dispose()
  }
})
test('petals have physical thickness and rounded side profiles',()=>{
  const top=petalPoint(.5,Math.PI/2),bottom=petalPoint(.5,Math.PI*1.5)
  assert.ok(top.y-bottom.y>.12)
  assert.ok(petalPoint(.5,0).x>.4)
  assert.ok(Math.abs(petalPoint(1,0).x)<.0001)
})
test('the two sides of each ring meet without a lighting seam',()=>{
  const g=createPetalGeometry()
  for(let r=0;r<=64;r++)for(const name of ['position','normal']){
    const a=g.attributes[name],first=r*33,last=first+32
    assert.ok(Math.abs(a.getX(first)-a.getX(last))<.00001)
    assert.ok(Math.abs(a.getY(first)-a.getY(last))<.00001)
    assert.ok(Math.abs(a.getZ(first)-a.getZ(last))<.00001)
  }
  g.dispose()
})

test('petal surfaces face outward and respond to 3D ray selection',()=>{
  const geometry=createPetalGeometry(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material)
  mesh.updateMatrixWorld()
  const point=petalPoint(.5,Math.PI/2)
  const ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0))
  const hits=ray.intersectObject(mesh)
  assert.ok(hits.length>0,'The petal top must be visible from above')
  assert.ok(hits[0].face.normal.y>0,'Top normals point outward')
  geometry.dispose();material.dispose()
})
