import * as THREE from 'three';

// Function that displays a vector in the scene
export function displayVectorVf(particule) {
    const direction = particule.vf.clone().normalize();
    const origin = particule.mesh.position.clone();
    const length = 2; // Adjust the length as needed
    const color = 0xff0000; // Red color for the arrow

    const arrowHelper = new THREE.ArrowHelper(direction, origin, length, particule.material.color.getHex());
    return arrowHelper;
}

export default { displayVectorVf };