import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Merge only immutable, opaque geometry inside one transform boundary.
 * Animated roots, clickable tiles, transparent layers and optional-decoration
 * visibility boundaries are excluded by the caller. Shared source resources
 * remain owned by the renderer's kit; newly merged geometry is level-owned.
 */
export function batchStaticScenery(root, boundaries = new Set()) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), groups = new Map();
  function visit(object) {
    if (!object.visible || (object !== root && boundaries.has(object))) return;
    if (object.isMesh && !object.isSkinnedMesh && !object.isInstancedMesh && !object.children.length && !Array.isArray(object.material) &&
        !object.material.vertexColors &&
        !object.material.transparent && !object.material.map && !object.userData.tile &&
        !object.morphTargetInfluences && object.matrixWorld.determinant() > 0 && object.geometry?.attributes.position) {
      const key = `${object.material.uuid}:${object.renderOrder}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(object);
    }
    for (const child of object.children) visit(child);
  }
  visit(root);
  let removed = 0, batches = 0;
  for (const objects of groups.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      // Untextured opaque materials need only position and normal attributes.
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const batch = new THREE.Mesh(merged, objects[0].material);
    batch.name = 'Batched static scenery';
    batch.renderOrder = objects[0].renderOrder;
    for (const object of objects) object.removeFromParent();
    root.add(batch);
    removed += objects.length - 1; batches++;
  }
  return { removedDrawCandidates: removed, batches };
}
