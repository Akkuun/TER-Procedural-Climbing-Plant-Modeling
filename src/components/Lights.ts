import * as THREE from 'three';

export function addLights(scene: { add: (arg0: THREE.DirectionalLight) => void; }) : void {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10).normalize();
    scene.add(light);
}