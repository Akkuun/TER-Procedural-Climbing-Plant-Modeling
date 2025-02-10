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
const mouse = new THREE.Vector2();
let prev_mouse = new THREE.Vector2();
let mouse_down = false;
let moving_particle = null;
let raycaster = new THREE.Raycaster();

document.body.appendChild(renderer.domElement);

// Ajout de lumières
addLights(scene);


// Load GLTF model using GLTFModelLoader class
const modelLoader = new GLTFModelLoader('./src/assets/GLTF/scene.gltf', scene,'./src/assets/GLTF/textures/Muchkin2_baseColor.png');
modelLoader.applyTexture(scene);
modelLoader.loadModel();

// Ajout des contrôles
const controls = setupControls(camera, renderer.domElement);

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

// Toggle camera controls on / off
document.addEventListener('keydown', (event) => {
    if (event.key === 'c') {
        controls.enabled = !controls.enabled;
    }
});

// Events for particles translation
document.addEventListener( 'mousedown', onDocumentMouseDown );
document.addEventListener( 'mouseup', onDocumentMouseUp );
document.addEventListener( 'mousemove', onDocumentMouseMove );
function onDocumentMouseDown( event ) {
    event.preventDefault();
    if (controls.enabled) return;
    mouse_down = true;

    prev_mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    prev_mouse.y = -((event.clientY / window.innerHeight) * 2 - 1);

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -((event.clientY / window.innerHeight) * 2 - 1)
    
    raycaster.setFromCamera(mouse, camera)

    let imax = -1;
    let lmax = 0;
    for (let i = 0; i < particles.length; i++) {
        const hits = raycaster.intersectObject(particles[i].mesh);
        if (hits.length) {
            if (hits[0].distance < lmax) continue;
            imax = i;
            lmax = hits[0].distance;
        }
    }
    if (imax === -1) return;
    moving_particle = particles[imax]
    moving_particle.mesh.material.color.setHex(Math.random() * 0xffffff);
}
function onDocumentMouseUp( event ) {
    event.preventDefault();
    if (controls.enabled) return;
    mouse_down = false;
}
function onDocumentMouseMove( event ) {    
    event.preventDefault();
    if (!mouse_down || controls.enabled || !moving_particle) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -((event.clientY / window.innerHeight) * 2 - 1)
    
    let translation = new THREE.Vector3();

    // Needs to be fixed
    translation.subVectors(moving_particle.mesh.position, camera.position);
    translation.normalize();
    translation.multiplyScalar((mouse.x - prev_mouse.x) * translation.length());
    moving_particle.physicsBody.position = moving_particle.physicsBody.position.vadd(new CANNON.Vec3(translation.x, translation.y, translation.z));
    
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