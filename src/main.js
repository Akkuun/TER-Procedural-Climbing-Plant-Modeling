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
import PlaneTerrain from './components/PlaneTerrain.js';
import { GROUP_PLANT, GROUP_GROUND } from './utils/Engine.js';

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

// Ground
let ground = new PlaneTerrain(world, 50, -1, new THREE.MeshStandardMaterial({ color: 0x808080 }));
ground.addToScene(scene);

// Particles rope
const particles = [];
for (let i = 0; i < 50; i++) {
    const particule = new Particule(0.5, 32, 16,
        new THREE.Vector3(
            Math.random() * 1 - .5,
            i * 1.8,
            Math.random() * 1 - .5),
        new THREE.Euler(
            0,
            0,
            0),
        new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        }), new THREE.Mesh(), world, 2, i === 0);
    if (i > 0) {
        particles[i - 1].addChildParticle(particule);
    }
    particule.createEllipsoid();
    particule.addToScene(scene);
    particles.push(particule);
}
document.addEventListener( 'mousedown', onDocumentMouseDown );
function onDocumentMouseDown( event ) {    
    event.preventDefault();
    var mouse3D = new CANNON.Vec3( ( event.clientX / window.innerWidth ),// * 2 - 1,   
                            -( event.clientY / window.innerHeight ),// * 2 + 1,  
                            0.5 );
    console.log("Mouse pos : ", mouse3D)
    var rayStart = mouse3D;
    var rayDirection = new CANNON.Vec3(0, 0, 1);
    var ray = new CANNON.Ray(rayStart, rayDirection);
    var result = new CANNON.RaycastResult();
    world.raycastClosest(rayStart, rayDirection, {}, result);
    console.log("Result : ", result);
    // move the object hit
    if (result.hasHit) {
        console.log("Hit point : ", result.hitPointWorld);
        result.body.position += new CANNON.Vec3(0, 1, 0);
    }

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