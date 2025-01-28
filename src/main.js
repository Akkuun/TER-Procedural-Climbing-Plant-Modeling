import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './components/Renderer';
import { addLights } from './components/Lights';
import { setupControls } from './components/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as THREE from "three";
import GLTFModelLoader from './utils/Loader.js';
import * as CANNON from 'cannon-es';
import { createCube } from './components/Cube';
import  Particule  from './components/Particule.js';

// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const monitor = new Monitor();

document.body.appendChild(renderer.domElement);

// Ajout de lumières
addLights(scene);


// Load GLTF model using GLTFModelLoader class
const modelLoader = new GLTFModelLoader('./src/assets/GLTF/scene.gltf', scene,'./src/assets/GLTF/textures/Muchkin2_baseColor.png');
modelLoader.applyTexture(scene);
modelLoader.loadModel();

// Ajout des contrôles
setupControls(camera, renderer.domElement);

// Setup physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Create a ground plane
const groundBody = new CANNON.Body({
    mass: 0, // mass = 0 makes the body static
    shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.position.set(0, -1, 0);
world.addBody(groundBody);

// Plane corresponding to the ground
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
scene.add(ground);


// Also apply physics to a particule. A particule is an ellpisoid 3D shape
const particule = new Particule(0.5, 32, 16, 0x00ff00, new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, 0), new THREE.MeshPhongMaterial({ color: 0x00ff00 }), new THREE.Mesh());
scene.add(particule.mesh);

const particuleBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Cylinder(0.5, 0.5, 1, 32),
});
particuleBody.position.set(0.1, 5, 0);

world.addBody(particuleBody);

const particle2 = new Particule(0.5, 32, 16, 0x00ff00, new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, 0), new THREE.MeshPhongMaterial({ color: 0x00ff00 }), new THREE.Mesh());
scene.add(particle2.mesh);

const particuleBody2 = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Cylinder(0.5, 0.5, 1, 32),
});
particuleBody2.position.set(1, 8, 0.1);

world.addBody(particuleBody2);

// Animation
function animate() {
    // Monitoring stats
    monitor.begin();

    requestAnimationFrame(animate);

    // Update physics
    world.step(1 / 60);

    particule.mesh.position.copy(particuleBody.position);
    particule.mesh.quaternion.copy(particuleBody.quaternion);

    particle2.mesh.position.copy(particuleBody2.position);
    particle2.mesh.quaternion.copy(particuleBody2.quaternion);

    monitor.end();
    renderer.render(scene, camera);
}
// Main loop
animate();

// Gestion du redimensionnement
handleResize(camera, renderer);