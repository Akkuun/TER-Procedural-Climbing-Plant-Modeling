import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './components/Renderer';
import { addLights } from './components/Lights';
import { setupControls } from './components/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as THREE from "three";
import GLTFModelLoader from './utils/Loader.js';

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
modelLoader.loadModel();

// Ajout des contrôles
setupControls(camera, renderer.domElement);

// Animation
function animate() {
    // Monitoring stats
    monitor.begin();

    requestAnimationFrame(animate);

    monitor.end();
    renderer.render(scene, camera);
}
// Main loop
animate();

// Gestion du redimensionnement
handleResize(camera, renderer);