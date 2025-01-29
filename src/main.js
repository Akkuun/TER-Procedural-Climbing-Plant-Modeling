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
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
scene.add(ground);

// Particles
const particles = [];
/*for (let i = 0; i < 50; i++) {
    const particule = new Particule(0.5, 32, 16, 0x00ff00,
        new THREE.Vector3(
            Math.random() * 5 - 2.5,
            Math.random() * 10 + 5,
            Math.random() * 5 - 2.5),
        new THREE.Euler(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI),
        new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        }), new THREE.Mesh(), world);
    particule.createEllipsoid();
    particule.addToScene(scene);
    particles.push(particule);
}*/

for (let i = 0; i < 50; i++) {
    const particule = new Particule(0.5, 32, 16, 0x00ff00,
        new THREE.Vector3(
            Math.random() * 1 - 0.5,
            i * 1.8 + 5,
            Math.random() * 1 - 0.5),
        new THREE.Euler(
            0,
            0,
            0),
        new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        }), new THREE.Mesh(), world);
    particule.createEllipsoid();
    particule.addToScene(scene);
    particles.push(particule);
}

// Attach particles between them
for (let i = 0; i < particles.length - 1; i++) {
    const constraint = new CANNON.PointToPointConstraint(
        particles[i].physicsBody,
        new CANNON.Vec3(0, 0.9, 0),
        particles[i + 1].physicsBody,
        new CANNON.Vec3(0, -0.9, 0)
    );
    world.addConstraint(constraint);
}

// Animation
function animate() {
    // Monitoring stats
    monitor.begin();

    requestAnimationFrame(animate);

    // Update physics
    world.step(1 / 60);
    // Update particules based on physics calculations
    for (const particule of particles) particule.update();

    monitor.end();
    renderer.render(scene, camera);
}
// Main loop
animate();

// Gestion du redimensionnement
handleResize(camera, renderer);