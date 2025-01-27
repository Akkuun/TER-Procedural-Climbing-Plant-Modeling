import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './components/Renderer';
import { addLights } from './components/Lights';
import { setupControls } from './components/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';

import * as THREE from "three";
import Particule from "./components/Particule";

// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

document.body.appendChild(renderer.domElement);

// Ajout de lumières
addLights(scene);




const particle = new Particule( 0.5, 32, 16, 0x00ff00, {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: Math.PI/2}, new THREE.MeshPhongMaterial({color: 0x00ff00}), null);
scene.add(particle.mesh);

// Ajout des contrôles
setupControls(camera, renderer.domElement);

// Monitor
const monitor = new Monitor();

// Animation
function animate() {
    // Monitoring stats
    monitor.begin();

    requestAnimationFrame(animate);

    // Rotation du cube
    particle.update();

    monitor.end();
    renderer.render(scene, camera);
}
//main loop
animate();

// Gestion du redimensionnement
handleResize(camera, renderer);