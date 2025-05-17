import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { Camera, PerspectiveCamera, Vector3, WebGLRenderer, MeshPhongMaterial } from 'three';
import * as THREE from 'three';
import {Particle} from '../components/Particle';


let dragControls: DragControls;
let camControls: OrbitControls;

export const controlsParams = {
    plantSeedMode: false,
};



/**
 * 
 * @param {Particule[]} particles to apply drag controls on
 * @param {PerspectiveCamera} camera 
 * @param {WebGLRenderer} renderer 
 */
export function setupControls(particles: Particle[], camera: PerspectiveCamera, renderer: WebGLRenderer) {
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

export function updateControls() {
    if (camControls) {
        camControls.update();
    }
}

export function setupCameraControls(camera: Camera, domElement: HTMLElement | null | undefined) {
    camControls = new OrbitControls(camera, domElement);
    
    // Basic settings
    camControls.enableDamping = true;
    camControls.dampingFactor = 0.45;
    
    // Speed settings
    camControls.rotateSpeed = 0.8;
    camControls.zoomSpeed = 1.0;
    camControls.panSpeed = 1.0;
    
    // Mouse button settings - this is the crucial part
    camControls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    
    // Touch settings
    camControls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    
    // Set reasonable limits
    camControls.minPolarAngle = 0;
    camControls.maxPolarAngle = Math.PI * 0.85;
    camControls.minDistance = 0.05;
    camControls.maxDistance = 100;
    
    // Ensure panning is enabled
    camControls.enablePan = true;
    
    // Make sure rotation is around the scene center
    camControls.target.set(0, 0, 0);
    
    return camControls;
}

let moving_particle: Particle | null = null;
function setupDragControls(particles: any[], camera: Camera, domElement: HTMLElement | null | undefined) {
    const controls = new DragControls(particles.map(p => p.mesh), camera, domElement);
    controls.addEventListener('dragstart', function (event) {
        // Change color of selected particle
        moving_particle = particles.find(p => p.mesh === event.object);
        if (moving_particle) {
            const material = moving_particle.mesh.material;
            if (material instanceof MeshPhongMaterial) {
                material.color.setHex(Math.random() * 0xffffff);
            } else {
                console.warn("The material does not support color changes.");
            }
        }
    });
    
    /*controls.addEventListener('drag', function (event) {
        // Move the particle
        if (moving_particle) {
            const newPosition = new Vector3();
            newPosition.copy(event.object.position);
            moving_particle.physicsBody.position.set(newPosition.x, newPosition.y, newPosition.z);
            // Check distance to parent particle
            if (moving_particle.parentParticle) {
                console.log("Checking distance");
                const distance = moving_particle.mesh.position.distanceTo(moving_particle.parentParticle.mesh.position);
                const maxDistance = MAX_DISTANCE_CONSTRAINT; // Set your max distance threshold here
                if (distance > maxDistance) {
                    moving_particle.parentParticle.removeChildParticle(moving_particle);
                }
            }
        }

    });*/
    
    controls.addEventListener('dragend', function (event) {
        moving_particle = null;
    });
    return controls;
}

export function setupMouseInteraction(
    camera: THREE.PerspectiveCamera, 
    renderer: THREE.WebGLRenderer, 
    scene: THREE.Scene, 
    particles: Particle[][],
    ground: THREE.Object3D
) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Track mouse position
    function onMouseMove(event: MouseEvent) {
        // Calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components
        mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    }

    // Handle click events
    function onClick(event: MouseEvent) {
        // Only handle left clicks (button 0)
        if (event.button !== 0) return;
        if (!controlsParams.plantSeedMode) return;

        // Update the raycaster with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Find intersections with the ground
        const intersects = raycaster.intersectObject(ground, true);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const point = intersection.point;
            
            console.log(`Creating new particle at: ${point.x}, ${point.y}, ${point.z}`);
            
            // Create a new particle at the intersection point
            const newParticle = new Particle(
                new THREE.Vector3(point.x, point.y, point.z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)), // upwards
                new THREE.MeshStandardMaterial({
                    color: 0x22ff33
                }), 
                scene, 
                0, 
                true
            );
            
            // Add the particle as a new single-particle group
            particles.push([newParticle]);
        }
    }

    // Add event listeners
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    renderer.domElement.addEventListener('click', onClick, false);

    // Return a function to remove event listeners if needed
    return function cleanup() {
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('click', onClick);
    };
}