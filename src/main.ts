import { createScene } from './components/Scene';
import { createCamera } from './components/Camera';
import { createRenderer } from './utils/Renderer';
import LightManager from "./components/LightManager.js";
import { updateControls, setupCameraControls, setupMouseInteraction } from './utils/Controls';
import { handleResize } from './utils/ResizeHandler';
import Monitor from './utils/Monitor';
import * as CANNON from 'cannon-es';
import {Particle} from './components/Particle';
import { updateParticleGroup } from './components/Particle';
import PlaneTerrain from './components/PlaneTerrain.js';
import * as THREE from 'three';
import { setupLightGUI } from './components/LightGUI.js';
import { isObjectInShadow, isObjectInShadowWithRay } from "./utils/ObjectInShadow.js";
import { lightParams } from "./components/LightManager.js";
import {
    computeBoundsTree, disposeBoundsTree,
    computeBatchedBoundsTree, disposeBatchedBoundsTree,
    acceleratedRaycast
} from 'three-mesh-bvh';

import { GLTFLoader } from './utils/GLTFLoader.js';
import { Octree } from './utils/Octree.js';
import { OctreeHelper, OCTREE_VISIBLE } from './utils/OctreeHelper.js';

let gravity = new THREE.Vector3(0, -9.81, 0);
let externalForce = new THREE.Vector3(0, 0, 0);

//for BVH
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
THREE.BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree;
THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;

// Création des éléments principaux
const scene: THREE.Scene = createScene();
const camera: THREE.PerspectiveCamera = createCamera();
const renderer: THREE.WebGLRenderer = createRenderer();
const monitor: Monitor = new Monitor();
const lightsManager: LightManager = new LightManager(scene);

let particles : Particle [][] = [];

const FPS : number = 80;
const FRAME_DELAY : number = 1000 / FPS;
let lastFrameTime : number = 0;
const eta : number = 5;
const fixed_delta_t : number = 1 / FPS;

document.body.appendChild(renderer.domElement);

lightParams.width = 50;
lightParams.height = 100;

function loadModel(loader: GLTFLoader, path: string, position: THREE.Vector3, scale: number, octree: Octree, helpers: THREE.Object3D[]) {
    return new Promise<void>((resolve, reject) => {
        loader.setPath(path);
        loader.load(
            'scene.gltf',
            (gltf: { scene: THREE.Object3D<THREE.Object3DEventMap>; }) => {
                scene.add(gltf.scene);

                // Scale and position the model
                gltf.scene.scale.set(scale, scale, scale);
                gltf.scene.position.copy(position);

                // Add the model to the octree
                octree.fromGraphNode(gltf.scene);

                // Add an octree helper for visualization
                const helper = new OctreeHelper(octree);
                helper.visible = OCTREE_VISIBLE.value;
                helpers.push(helper);
                scene.add(helper);

                resolve(); // Resolve the promise when the model is loaded
            },
            undefined,
            (error: any) => {
                console.error(`Error loading model from ${path}:`, error);
                reject(error); // Reject the promise if there's an error
            }
        );
    });
}

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

let octree: Octree = new Octree();
let helpers: THREE.Object3D<THREE.Object3DEventMap>[] = [];

async function initialize() {
    const loader: GLTFLoader = new GLTFLoader();

    const loaderElement = document.getElementById('loader');
    if (loaderElement) {
        loaderElement.style.display = 'block';
    }

    try {
        // Load all models
        await Promise.all([
            loadModel(loader, './src/assets/GLTF/stone_arc/', new THREE.Vector3(4, 4.5, 0), 10, octree, helpers),
            loadModel(loader, './src/assets/GLTF/oia_cat/', new THREE.Vector3(-9, -1, 0), 20, octree, helpers),
            loadModel(loader, './src/assets/GLTF/ruined_house/', new THREE.Vector3(10, -1, 20), 2, octree, helpers),
            //loadModel(loader, './src/assets/GLTF/donut_saucisse/', new THREE.Vector3(-10, -1, 15), 5, octree, helpers),
        ]);

        console.log('All models loaded.');
        if (loaderElement) {
            loaderElement.style.display = 'none';
        }

        setupCameraControls(camera, renderer.domElement);

        setupMouseInteraction(camera, renderer, scene, particles, ground.mesh);

        // Start the animation loop
        animate();

    } catch (error) {
        console.error('Error during initialization:', error);
        if (loaderElement) {
            loaderElement.innerText = 'Error loading models. Check the console for details.';
        }
    }
}

// button to search fix point for particle
const button = document.createElement('button');
button.innerHTML = "Find fix point";
button.style.position = 'absolute';
button.style.top = '70px';
button.style.left = '70px';
document.body.appendChild(button);
button.onclick = function () {
    for (const particule of particles[0]) {
        let v_s = particule.getVs();
        console.log("v_s : " + v_s.x + " " + v_s.y + " " + v_s.z);
        console.log(particule.x_anchor);
        console.log(particule.x);
        // display the v_s vec3 in the scene
        const direction = v_s.clone().normalize();
        const origin = particule.x.clone().add(v_s.clone().multiplyScalar(particule.dimensions.y/2));
        const length = 5; // Adjust the length as needed
        const color = particule.material.color.getHex(); // Red color for the arrow
        const arrowHelper = new THREE.ArrowHelper(direction, origin, length,color)
        if (arrowHelper) {
            scene.add(arrowHelper);
        }
        //scene.add(simpleVector);
    }
}

// GUI controls
setupLightGUI(lightsManager, lightParams, updateLight, updateCamera, updateOctree);
function updateLight() : void {
    lightsManager.updateLight(0, lightParams);
    const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('point'), scene);
    console.log(`RAY : Point is in shadow: ${inShadow}`);

}

function updateCamera() : void {
    const light = lightsManager.lights[0].light;
    if("target" in light && light.target) {
        if (light.target instanceof THREE.Object3D) 
        light.target.updateMatrixWorld();

    }
    lightsManager.lights[0].lightHelper.update();
    if (light.shadow && ( light.shadow.camera instanceof THREE.PerspectiveCamera || light.shadow.camera instanceof THREE.OrthographicCamera)) {
        light.shadow.camera.updateProjectionMatrix();
    }
    lightsManager.lights[0].cameraHelper?.update();
}

function updateOctree() : void {
    for (const helper of helpers) {
        helper.visible = OCTREE_VISIBLE.value;
    }
}

// Setup physics world
const world : CANNON.World = new CANNON.World();
world.gravity.set(0, 0, -9.82);
world.broadphase = new CANNON.SAPBroadphase(world);


const textureLoader = new THREE.TextureLoader();
const baseColor = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_BaseColor.jpg');
const ambientOcclusion = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_AmbientOcclusion.jpg');
const height = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Height.jpg');
const normal = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Normal.jpg');
const roughness = textureLoader.load('./src/assets/Maps/grass_maps/Grass_005_Roughness.jpg');

// Ground
//let ground = new PlaneTerrain(world, 50, -1, new THREE.MeshStandardMaterial({color: 0x808080}));
let ground = new PlaneTerrain(world, 100, -1, new THREE.MeshStandardMaterial({
    map: baseColor,
    aoMap: ambientOcclusion,
    displacementMap: height,
    normalMap: normal,
    roughnessMap: roughness
}));
ground.addToScene(scene);

// // créé le point 0 0 0 et l'ajouter a la scenne pour tester ma fonction avec les ombres
// const point = coordonneToObject({ x: 0, y: 0, z: 0 });
// point.name = "point";
// scene.add(point);

//boucle sur les objet contenue dans scene, si ils n'on pas de nom alors on lui en donne un qui est son type concaténé avec son index
scene.children.forEach((object, index) => {
    if (!object.name) {
        object.name = object.type + index;
    }
});

// Animation
function animate(currentTime : number = 0) {
    if (currentTime - lastFrameTime >= FRAME_DELAY) {
        lastFrameTime = currentTime;
        // Monitoring stats
        monitor.begin();
        updateControls();
        
        // Update physics
        //world.step(fixed_delta_t);
            // Update particules based on physics calculations
        //updateParticleGroup(fixed_delta_t, particles , gravity, externalForce, lightsManager.lights[0].light, scene, octree, eta);
        for (let particlesGroup of particles) { 
            updateParticleGroup(fixed_delta_t, particlesGroup , gravity, externalForce, lightsManager.lights[0].light, scene, octree, eta);
        }
        // console.log("Particles :");
        // horizontalParticles.forEach((particle, index) => {
        //     console.log(`Particle ${index}:`, particle);
        // });

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
    requestAnimationFrame(animate);
}

// Main loop
initialize();

// Gestion du redimensionnement
handleResize(camera, renderer);

const inShadow = isObjectInShadowWithRay(lightsManager.lights[0].light, scene.getObjectByName('point'), scene);
console.log(`RAY : Point is in shadow: ${inShadow}`);

const inShadow2 = isObjectInShadow(lightsManager.lights[0].light, scene.getObjectByName('point'));
console.log(`RAY : Point is in shadow: ${inShadow2}`);



// const controls = new THREE.OrbitControls(camera, renderer.domElement);
// controls.addEventListener('change', () => {
//     renderer.render(scene, camera);
// });
