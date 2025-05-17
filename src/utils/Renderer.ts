import * as THREE from 'three';

export function createRenderer() : THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    //ombre
    renderer.shadowMap.enabled = true;
    return renderer;
}

