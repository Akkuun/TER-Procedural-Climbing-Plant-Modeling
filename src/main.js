import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './components/Renderer';
import LightManager from "./components/LightManager.js";
import { setupControls } from './components/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as THREE from "three";
import GUI from 'lil-gui';
import GLTFModelLoader from './utils/Loader.js';
import lightManager from "./components/LightManager.js";

// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const monitor = new Monitor();
const lightsManager = new LightManager(scene);

document.body.appendChild(renderer.domElement);


// Paramètres de la lumière
const lightParams = {
    lx: 0,
    ly: 11.9,
    lz: -13,
    tx: 0,
    ty: 2.1,
    tz: -1.6,
    color: 0xffffff,
    intensity: 1.4,
    size: 1,
    colorHelper: 0x000000
};


// Ajout de lumières
lightsManager.addLight(lightParams, lightParams, lightParams.color, lightParams.intensity, lightParams.size, lightParams.colorHelper);

// GUI controls
const gui = new GUI({ container: document.getElementById('gui-container') });
const lightFolder = gui.addFolder('Light Position');
lightFolder.add(lightParams, 'lx', -50, 50).onChange(updateLight);
lightFolder.add(lightParams, 'ly', -50, 50).onChange(updateLight);
lightFolder.add(lightParams, 'lz', -50, 50).onChange(updateLight);
lightFolder.add(lightParams, 'intensity', 0, 10).onChange(updateLight);
lightFolder.open();

const targetFolder = gui.addFolder('Target Position');
targetFolder.add(lightParams, 'tx', -50, 50).onChange(updateLight);
targetFolder.add(lightParams, 'ty', -50, 50).onChange(updateLight);
targetFolder.add(lightParams, 'tz', -50, 50).onChange(updateLight);
targetFolder.open();

function updateLight() {
    lightsManager.updateLight(0, lightParams, lightParams, lightParams.color, lightParams.intensity, lightParams.size, lightParams.colorHelper);
}
// Load GLTF model using GLTFModelLoader class
// const modelLoader = new GLTFModelLoader('./src/assets/GLTF/scene.gltf', scene,'./src/assets/GLTF/textures/Muchkin2_baseColor.png');
// modelLoader.loadModel();

// Chargement des textures
const textureLoader = new THREE.TextureLoader();
const baseColor = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_BaseColor.jpg');
const ambientOcclusion = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_AmbientOcclusion.jpg');
const height = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Height.jpg');
const normal = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Normal.jpg');
const roughness = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Roughness.jpg');
// Création de la géométrie du plan
const planeGeometry = new THREE.PlaneGeometry(13*2, 13*2, 100, 100);
//Création du matériau du plan
const planeMaterial = new THREE.MeshStandardMaterial({
    map: baseColor,
    aoMap: ambientOcclusion,
    displacementMap: height,
    normalMap: normal,
    roughnessMap: roughness
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
// Rotation et positionnement du plan
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1;
plane.receiveShadow = true;
// Ajout du plan à la scène
scene.add(plane);

// Création d'un cube
const cubeGeometry = new THREE.BoxGeometry();
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
// Positionnement du cube qui en hauteur fit le plan
cube.position.x = 2;
cube.position.y = plane.position.y;
cube.position.y *=0.5;
cube.castShadow = true;
cube.receiveShadow = true;
// Ajout du cube à la scène
scene.add(cube);




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


// const controls = new THREE.OrbitControls(camera, renderer.domElement);
// controls.addEventListener('change', () => {
//     renderer.render(scene, camera);
// });
