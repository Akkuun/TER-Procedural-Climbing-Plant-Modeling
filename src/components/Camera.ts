import * as THREE from 'three';

export function createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        75, // Field of view
        window.innerWidth / window.innerHeight, // Aspect ratio
        0.1, // Near clipping plane
        1000 // Far clipping plane
    );
    camera.position.z = 50;
    camera.position.y = 10;
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // Look at the origin
    camera.updateProjectionMatrix(); // Update the projection matrix after changes
    return camera;
}