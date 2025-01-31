import {createScene} from './components/Scene';
import {createCamera} from './components/Camera';
import {createRenderer} from './utils/Renderer.js';
import {addLights} from './components/Lights';
import {setupControls} from './utils/Controls.js';
import {handleResize} from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as CANNON from 'cannon-es';
import Particule from './components/Particule.js';
import PlaneTerrain from './components/PlaneTerrain.js';
import {createCube} from "./components/Cube.js";
import {displayVectorVf, displayVectorVs} from "./utils/VectorHelper.js";
import * as THREE from 'three';
import {
    computeBoundsTree, disposeBoundsTree,
    computeBatchedBoundsTree, disposeBatchedBoundsTree,
    acceleratedRaycast,
    MeshBVHHelper
} from 'three-mesh-bvh';

//for BVH
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
THREE.BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree;
THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;


// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const monitor = new Monitor();
document.body.appendChild(renderer.domElement);
addLights(scene);

//Cube to represent the object mesh
const cube = createCube();
scene.add(cube.translateX(-4).translateY(0));


// Create a BVH visualizer and add it to the scene
const visualizer = new MeshBVHHelper(cube,4);
scene.add(visualizer);

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
        let simpleVector = displayVectorVf(particule);
        let simpleVector2 = displayVectorVs(particule);
        scene.add(simpleVector);


    }
}


// Ajout des contrôles
setupControls(camera, renderer.domElement);

// Setup physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Ground
let ground = new PlaneTerrain(world, 50, -1, new THREE.MeshStandardMaterial({color: 0x808080}));
ground.addToScene(scene);

// Particles rope
const particles = [];
for (let i = 0; i < 4; i++) { //TODO CHANGE TO 50
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