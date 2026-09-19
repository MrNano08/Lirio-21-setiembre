import * as THREE from 'three'

export const PETAL_COUNT = 6
export function petalPoint(u, angle, length = 2.05, width = .62) {
  const bell = Math.sqrt(Math.max(0, Math.sin(Math.PI * u)))
  const v = Math.cos(angle)
  return new THREE.Vector3(
    width * bell * (.81 + .19 * u) * v + .035 * Math.sin(u * Math.PI),
    .66 * Math.sin(Math.PI * .85 * u) - .23 * u ** 3 + .36 * u
      + .08 * v * v * bell + .085 * bell * Math.sin(angle),
    .13 + length * u,
  )
}

// Closed, rounded cross-sections: not a single flat sheet. Seam normals
// are averaged so the petal remains smooth under light from every direction.
export function createPetalGeometry(length = 2.05, width = .62, rows = 64, cols = 32) {
  const positions = [], uvs = [], indices = [], colors = []
  const base = new THREE.Color(), light = new THREE.Color('#ffe8a0'), dark = new THREE.Color('#d5a83d')
  for (let i = 0; i <= rows; i++) {
    const u = Math.min(.99999, Math.max(.00001, i / rows))
    for (let j = 0; j <= cols; j++) {
      const a = j / cols * Math.PI * 2
      const p = petalPoint(u, a, length, width)
      positions.push(p.x, p.y, p.z)
      uvs.push((Math.cos(a) + 1) * .5, u)
      const brightness = THREE.MathUtils.clamp(.27 + .6 * u + .07 * Math.sin(u * 19 + Math.cos(a) * 4), 0, 1)
      base.copy(dark).lerp(light, brightness)
      colors.push(base.r, base.g, base.b)
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1
    indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
  // Tiny end rings are capped, keeping the surface closed.
  for (let j = 1; j < cols - 1; j++) {
    indices.push(0, j + 1, j)
    const end = rows * (cols + 1)
    indices.push(end, end + j, end + j + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const normals = geometry.attributes.normal
  for (let i = 0; i <= rows; i++) {
    const first = i * (cols + 1), last = first + cols
    const n = new THREE.Vector3().fromBufferAttribute(normals, first)
      .add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize()
    normals.setXYZ(first, n.x, n.y, n.z); normals.setXYZ(last, n.x, n.y, n.z)
  }
  geometry.computeBoundingSphere()
  return geometry
}
