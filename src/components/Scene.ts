import * as THREE from 'three';

export function createScene() : THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    return scene;
}

