import * as THREE from 'three';
import {createCube} from "../components/Cube.js";

// Function that displays a vector in the scene
export function displayVector(vector) {
    const origin = new THREE.Vector3(0, 0, 0);
    const arrow = new THREE.ArrowHelper(vector, origin, vector.length(), 0xffff00);
    return arrow;
}

export default { displayVector };