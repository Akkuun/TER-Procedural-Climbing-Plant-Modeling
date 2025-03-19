import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './utils/Renderer';
import LightManager from "./components/LightManager.js";
import { setupControls } from './utils/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as CANNON from 'cannon-es';
import {particleRope, particleTree} from './components/Particule.js';
import PlaneTerrain from './components/PlaneTerrain.js';
import { createCube } from "./components/Cube.js";
import { displayVectorVf, displayVectorVs } from "./utils/VectorHelper.js";
import * as THREE from 'three';
import { setupLightGUI } from './components/LightGUI.js';
import { isObjectInShadowWithRay } from "./utils/ObjectInShadow.js";
import { coordonneToObject } from "./utils/coordonneToObject.js";
import { lightParams } from "./components/LightManager.js";
import {
    computeBoundsTree, disposeBoundsTree,
    computeBatchedBoundsTree, disposeBatchedBoundsTree,
    acceleratedRaycast,
    MeshBVHHelper
} from 'three-mesh-bvh';

import { GLTFLoader } from './utils/GLTFLoader.js';
import { Octree } from './utils/Octree.js';
import { OctreeHelper, OCTREE_VISIBLE } from './utils/OctreeHelper.js';

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
const lightsManager = new LightManager(scene);

document.body.appendChild(renderer.domElement);

lightParams.width = 50;
lightParams.height = 100;


// Ajout de lumières
lightsManager.addLight(lightParams);

// const modelLoader = new GLTFModelLoader('./src/assets/GLTF/stone_arc/scene.gltf', scene, './src/assets/GLTF/textures/stone_arc.jpeg');
// modelLoader.loadModel(new THREE.Vector3(8, 10, 0), 20, (model, error) => {
//     if (error) {
//         console.error('Error loading model:', error);
//     } else {
//         scene.add(model);
        
//         console.log('Model loaded:', model);

//         let visualizerArc = new MeshBVHHelper(model., 32);
//         scene.add(visualizerArc);
//     }
// });

let octree = new Octree();
let helpers = [];

const loader = new GLTFLoader().setPath('./src/assets/GLTF/stone_arc/');
loader.load('scene.gltf', function (gltf) {
    
    scene.add(gltf.scene);

    // scale the mesh
    gltf.scene.scale.set(10, 10, 10);

    // translate the mesh
    gltf.scene.position.set(4, 4.5, 0);

    octree.fromGraphNode(gltf.scene);

    helpers.push(new OctreeHelper(octree));
    helpers[helpers.length - 1].visible = OCTREE_VISIBLE.value;
    scene.add(helpers[helpers.length - 1]);

});

// oia cat load
loader.setPath('./src/assets/GLTF/oia_cat/');
loader.load('scene.gltf', function (gltf) {
    scene.add(gltf.scene);
    gltf.scene.scale.set(10, 10, 10);

    // translate the mesh
    gltf.scene.position.set(-9, 4.5, 0);

    octree.fromGraphNode(gltf.scene);

    helpers.push(new OctreeHelper(octree));
    helpers[helpers.length - 1].visible = OCTREE_VISIBLE.value;
    scene.add(helpers[helpers.length - 1]);
});

// button to search fix point for particle
const button = document.createElement('button');
button.innerHTML = "Find fix point";
button.style.position = 'absolute';
button.style.top = '70px';
button.style.left = '70px';
document.body.appendChild(button);
button.onclick = function () {
    for (const particule of particles) {
        particule.searchForAttachPoint(octree); //get vf
        let simpleVector = displayVectorVf(particule);
        let simpleVector2 = displayVectorVs(particule);
        scene.add(simpleVector2);
        //scene.add(simpleVector);
    }
}

// GUI controls
setupLightGUI(lightsManager, lightParams, updateLight, updateCamera, updateOctree);
function updateLight() {
    lightsManager.updateLight(0, lightParams);
    const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('point'), scene);
    console.log(`RAY : Point is in shadow: ${inShadow}`);

}

function updateCamera() {
    const light = lightsManager.lights[0].light;
    light.target.updateMatrixWorld();
    lightsManager.lights[0].lightHelper.update();
    light.shadow.camera.updateProjectionMatrix();
    lightsManager.lights[0].cameraHelper.update();
}

function updateOctree() {
    for (const helper of helpers) {
        helper.visible = OCTREE_VISIBLE.value;
    }
}

// Setup physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);

const textureLoader = new THREE.TextureLoader();
const baseColor = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_BaseColor.jpg');
const ambientOcclusion = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_AmbientOcclusion.jpg');
const height = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Height.jpg');
const normal = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Normal.jpg');
const roughness = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Roughness.jpg');

// Ground
//let ground = new PlaneTerrain(world, 50, -1, new THREE.MeshStandardMaterial({color: 0x808080}));
let ground = new PlaneTerrain(world, 50, -1, new THREE.MeshStandardMaterial({
    map: baseColor,
    aoMap: ambientOcclusion,
    displacementMap: height,
    normalMap: normal,
    roughnessMap: roughness
}));
ground.addToScene(scene);

// créé le point 0 0 0 et l'ajouter a la scenne pour tester ma fonction avec les ombres
const point = coordonneToObject({ x: 0, y: 0, z: 0 });
point.name = "point";
scene.add(point);

//boucle sur les objet contenue dans scene, si ils n'on pas de nom alors on lui en donne un qui est son type concaténé avec son index
scene.children.forEach((object, index) => {
    if (!object.name) {
        object.name = object.type + index;
    }
});

// Particles rope
const particles = particleRope(scene, world, 50);
//const particles = particleTree(scene, world, 10);

// Setup controls
setupControls(particles, camera, renderer);


console.log("Number of particles : " + particles.length);

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

const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('point'), scene);
console.log(`RAY : Point is in shadow: ${inShadow}`);



// const controls = new THREE.OrbitControls(camera, renderer.domElement);
// controls.addEventListener('change', () => {
//     renderer.render(scene, camera);
// });
