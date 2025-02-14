import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { Vector3 } from 'three';

export function setupCameraControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true; // Ajoute un amortissement pour une meilleure expérience utilisateur
    controls.dampingFactor = 0.05;
    return controls;
}

let moving_particle = null;
export function setupDragControls(particles, camera, domElement) {
    const controls = new DragControls(particles.map(p => p.mesh), camera, domElement);
    controls.addEventListener('dragstart', function (event) {
        // Change color of selected particle
        moving_particle = particles.find(p => p.mesh === event.object);
        moving_particle.mesh.material.color.setHex(Math.random() * 0xffffff);
    });
    
    controls.addEventListener('drag', function (event) {
        // Move the particle
        if (moving_particle) {
            const newPosition = new Vector3();
            newPosition.copy(event.object.position);
            moving_particle.physicsBody.position.set(newPosition.x, newPosition.y, newPosition.z);
        }
    });
    
    controls.addEventListener('dragend', function (event) {
        moving_particle = null;
    });
    return controls;
}