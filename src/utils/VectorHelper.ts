import * as THREE from 'three';
import Particule from '../components/Particule';

// Function that displays a vector in the scene
export function displayVectorVf(particule: Particule) : THREE.ArrowHelper | null {
    if(particule.vf == null){
        return null;
    }
    const direction = particule.vf.clone().normalize();
    const origin = particule.mesh.position.clone().add(particule.vf.clone().multiplyScalar(particule.lengthY/2));
    const length = 1; // Adjust the length as needed
    const color = particule.material.color.getHex(); // Red color for the arrow
    const arrowHelper = new THREE.ArrowHelper(direction, origin, length,color)

    return arrowHelper;
}
//vs is the vector pointing toward the clostest point of the surface
export function displayVectorVs(particule: Particule) : THREE.ArrowHelper | null {
    if(particule.vs == null){
        return null;
    }
    const direction = particule.vs;
    const origin = particule.mesh.position.add(particule.vs.clone().multiplyScalar(particule.lengthY/2));
    const length = 1; // Adjust the length as needed
    const color = particule.material.color.getHex(); // Red color for the arrow
    const arrowHelper = new THREE.ArrowHelper(direction, origin, length, color)

    return arrowHelper;
}

export default { displayVectorVf, displayVectorVs };