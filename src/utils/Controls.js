import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { Vector3 } from 'three';

let dragControls;
let camControls;

export function setupControls(particles, camera, renderer) {
    // Contrôles de déplacement des particules
    dragControls = setupDragControls(particles, camera, renderer.domElement);
    dragControls.enabled = false;

    // Contrôles de la caméra
    camControls = setupCameraControls(camera, renderer.domElement);
    camControls.enabled = true;

    // Key to switch between camera and drag controls
    document.addEventListener('keydown', (event) => {
        if (event.key === 'c' || event.key === 'C') {
            camControls.enabled = !camControls.enabled;
            dragControls.enabled = !dragControls.enabled;
        }
    });
}



function setupCameraControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true; // Ajoute un amortissement pour une meilleure expérience utilisateur
    controls.dampingFactor = 0.05;
    return controls;
}

let moving_particle = null;
function setupDragControls(particles, camera, domElement) {
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