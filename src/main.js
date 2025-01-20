import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './components/Renderer';
import { addLights } from './components/Lights';
import { createCube } from './components/Cube';
import { setupControls } from './components/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';

// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

document.body.appendChild(renderer.domElement);

// Ajout de lumières
addLights(scene);

// Ajout d'objets
const cube = createCube();
scene.add(cube);

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
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    monitor.end();
    renderer.render(scene, camera);
}
//main loop
animate();

// Gestion du redimensionnement
handleResize(camera, renderer);