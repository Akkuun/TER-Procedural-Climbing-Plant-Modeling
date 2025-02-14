import * as THREE from 'three';

/**
 * 
 * @param {THREE.BoxGeometry} size 
 * @param {THREE.Vector3} position 
 * @returns {THREE.Mesh} a cube mesh
 */
export function createCube(size, position) {
    const geometry = size == null ? new THREE.BoxGeometry(1,1,1) : size;
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name="cube";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.translateX(position.x);
    mesh.translateY(position.y);
    mesh.translateZ(position.z);
    // Compute the BVH for the mesh's geometry
    mesh.geometry.computeBoundsTree();

    return mesh;
}