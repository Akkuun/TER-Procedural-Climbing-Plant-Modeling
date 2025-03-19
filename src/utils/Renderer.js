import * as THREE from 'three';

export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    //ombre
    renderer.shadowMap.enabled = true;
    return renderer;
}

