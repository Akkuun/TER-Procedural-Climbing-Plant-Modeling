import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './components/Renderer';
import LightManager from "./components/LightManager.js";
import { setupControls } from './components/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as THREE from "three";
import GUI from 'lil-gui';
import { setupLightGUI } from './components/LightGUI.js';
import DimensionGUIHelper from './utils/DimensionGUIHelper.js';
import MinMaxGUIHelper from './utils/MinMaxGUIHelper.js';
import {isObjectInShadowWithRay, isObjectInShadow} from "./utils/ObjectInShadow.js";

// Création des éléments principaux
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const monitor = new Monitor();
const lightsManager = new LightManager(scene);

document.body.appendChild(renderer.domElement);


// Paramètres de la lumière
const lightParams = {
    type: 'DirectionalLight',
    lx: 0,
    ly: 11.9,
    lz: -13,
    tx: 0,
    ty: 2.1,
    tz: -1.6,
    color: 0xffffff,
    intensity: 1.4,
    size: 1,
    colorHelper: 0x000000,
    width: 10,
    height: 10,
    near: 0.5,
    far: 500,
    zoom: 1,
    shadowmapSizeWidth: 512,
    shadowmapSizeHeight: 512,
    bias: 0
};


// Ajout de lumières
lightsManager.addLight(lightParams.type,lightParams, lightParams, lightParams.color, lightParams.intensity, lightParams.size, lightParams.colorHelper, lightParams, lightParams);

// GUI controls
setupLightGUI(lightsManager, lightParams, updateLight, updateCamera);
function updateLight() {
    lightsManager.updateLight(0, lightParams, lightParams, lightParams.color, lightParams.intensity, lightParams.size, lightParams.colorHelper, lightParams, lightParams);
    // const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('cube'), scene);
    // console.log(`RAY : Cube is in shadow: ${inShadow}`);
    //
    // const inShadow2 = isObjectInShadow(lightsManager.lights[0].light, scene.getObjectByName('cube'));
    // console.log(`FRUSTUM : Cube is in shadow: ${inShadow2}`);
}
function updateCamera() {
    const light = lightsManager.lights[0].light;
    light.target.updateMatrixWorld();
    lightsManager.lights[0].lightHelper.update();
    light.shadow.camera.updateProjectionMatrix();
    lightsManager.lights[0].cameraHelper.update();
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
cube.name = "cube";
cube.castShadow = true;
cube.receiveShadow = true;
// Ajout du cube à la scène
scene.add(cube);

//cube qui bloque la lumière sur le premier cube
const cube2 = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube2.position.z = -4;
cube2.position.x = 2;
cube2.position.y = plane.position.y;
cube2.position.y *=0.5;
cube2.scale.set(6, 6, 6);
cube2.castShadow = true;
cube2.receiveShadow = true;
scene.add(cube2);



// Ajout des contrôles
setupControls(camera, renderer.domElement);

// Animation
function animate() {
    // Monitoring stats
    monitor.begin();

    requestAnimationFrame(animate);

    monitor.end();
    renderer.render(scene, camera);

    // /!\ Danger de mort de pc /!\
    // la clock de animate est bien trop rapide
    // const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('cube'), scene);
    // console.log(`RAY : Cube is in shadow: ${inShadow}`);
    //
    // const inShadow2 = isObjectInShadow(lightsManager.lights[0].light, scene.getObjectByName('cube'));
    // console.log(`FRUSTUM : Cube is in shadow: ${inShadow2}`);
}
// Main loop
animate();

// Gestion du redimensionnement
handleResize(camera, renderer);

const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('cube'), scene);
console.log(`RAY : Cube is in shadow: ${inShadow}`);

const inShadow2 = isObjectInShadow(lightsManager.lights[0].light, scene.getObjectByName('cube'));
console.log(`FRUSTUM : Cube is in shadow: ${inShadow2}`);


// const controls = new THREE.OrbitControls(camera, renderer.domElement);
// controls.addEventListener('change', () => {
//     renderer.render(scene, camera);
// });
