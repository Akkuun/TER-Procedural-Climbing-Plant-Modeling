import * as THREE from 'three';

export function createCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
// Compute the BVH for the mesh's geometry
    mesh.geometry.computeBoundsTree();

    return mesh;
}
