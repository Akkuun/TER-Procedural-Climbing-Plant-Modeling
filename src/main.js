import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './utils/Renderer.js';
import { addLights } from './components/Lights';
import { setupControls } from './utils/Controls.js';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as THREE from "three";
import * as CANNON from 'cannon-es';
import  Particule  from './components/Particule.js';
import PlaneTerrain from './components/PlaneTerrain.js';
import {createCube} from "./components/Cube.js";
import VectorHelper, {displayVector} from "./utils/VectorHelper.js";

// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const monitor = new Monitor();

document.body.appendChild(renderer.domElement);

addLights(scene);
const cube = createCube();
scene.add(cube.translateX(2));


// // Load GLTF model using GLTFModelLoader class
// const modelLoader = new GLTFModelLoader('./src/assets/GLTF/scene.gltf', scene,'./src/assets/GLTF/textures/Muchkin2_baseColor.png');
// modelLoader.applyTexture(scene);
// modelLoader.loadModel();

// button to search fix point for particle
const button = document.createElement('button');
button.innerHTML = "Find fix point";
button.style.position = 'absolute';
button.style.top = '70px';
button.style.left = '70px';
document.body.appendChild(button);
button.onclick = function () {
    for (const particule of particles) {
        particule.searchForAttachPoint(); //get vf
        console.log(particule.vf);
        displayVector(particule.vf);
    }
}



// Ajout des contrôles
setupControls(camera, renderer.domElement);

// Setup physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Ground
let ground = new PlaneTerrain(world, 50, -1, new THREE.MeshStandardMaterial({ color: 0x808080 }));
ground.addToScene(scene);

// Particles rope
const particles = [];
for (let i = 0; i < 3; i++) { //TODO CHANGE TO 50
    const particule = new Particule(0.5, 32, 16,
        new THREE.Vector3(
            Math.random() - .5,
            i * 1.8 + 5,
            Math.random() - .5),
        new THREE.Euler(
            0,
            0,
            0),
        new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        }), new THREE.Mesh(), world, 2);
    if (i > 0) {
        particles[i - 1].addChildParticle(particule);
    }
    particule.createEllipsoid();
    scene.add(particule.mesh);
    particles.push(particule);
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