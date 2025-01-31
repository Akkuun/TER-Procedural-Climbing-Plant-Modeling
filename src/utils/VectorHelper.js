import * as THREE from 'three';

// Function that displays a vector in the scene
export function displayVectorVf(particule) {
    const direction = particule.vf.clone().normalize();
    const origin = particule.mesh.position.clone();
    const length = 1; // Adjust the length as needed
    const color = particule.material.color.getHex(); // Red color for the arrow
    const arrowHelper = new THREE.ArrowHelper(direction, origin, length, particule.material.color.getHex());
    return arrowHelper;
}

export function displayVectorVs(particule) {
    console.log(particule);
    const direction = particule.vs.clone().normalize();
    const origin = particule.mesh.position.clone();
    const length = 1; // Adjust the length as needed
    const color = 0x00ff00; // Green color for the arrow

    const arrowHelper = new THREE.ArrowHelper(direction, origin, length, color);
    return arrowHelper;
}

export default { displayVectorVf, displayVectorVs };