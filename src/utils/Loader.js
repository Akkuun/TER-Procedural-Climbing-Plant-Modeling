// src/utils/GLTFModelLoader.js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

class GLTFModelLoader {
    constructor(filePath, scene, texturePath) {
        this.filePath = filePath;
        this.scene = scene;
        this.texturePath = texturePath;
        this.loader = new GLTFLoader();
    }

    loadModel() {
        this.loader.load(
            this.filePath,
            (gltf) => {
                this.scene.add(gltf.scene);
                if (this.texturePath) {
                    this.applyTexture(gltf.scene);
                }
            },
            undefined,
            (error) => {
                console.error('An error happened', error);
            }
        );
    }

    applyTexture(scene) {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(this.texturePath);
        scene.traverse((child) => {
            if (child.isMesh) {
                child.material.map = texture;
                child.material.needsUpdate = true;
            }
        });
    }
}

export default GLTFModelLoader;