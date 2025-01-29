import * as THREE from 'three';

class LightManager {
    constructor(scene) {
        this.scene = scene;
        this.lights = [];
    }

    addLight(lightPos = { lx: 0, ly: 0, lz: 0 }, targetPos = { tx: 0, ty: 0, tz: 0 }, color = 0xffffff, intensity = 1, size = 1, colorHelper = 0x000000) {
        const { lx, ly, lz } = lightPos;
        const { tx, ty, tz } = targetPos;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(lx, ly, lz);
        light.target.position.set(tx, ty, tz);
        light.size = size;

        // shadowmap
        light.castShadow = true;

        this.scene.add(light);
        this.scene.add(light.target);

        const ambientLight = new THREE.AmbientLight(color, intensity);
        this.scene.add(ambientLight);

        const lightHelper = new THREE.DirectionalLightHelper(light, size, colorHelper);
        this.scene.add(lightHelper);

        const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
        this.scene.add(cameraHelper);

        this.lights.push({ light, ambientLight, lightHelper, cameraHelper });
    }

    removeLight(index) {
        if (index >= 0 && index < this.lights.length) {
            const { light, ambientLight, lightHelper, cameraHelper } = this.lights[index];
            this.scene.remove(light);
            this.scene.remove(light.target);
            this.scene.remove(ambientLight);
            this.scene.remove(lightHelper);
            this.scene.remove(cameraHelper);
            this.lights.splice(index, 1);
        }
    }

    updateLight(index, lightPos, targetPos, color, intensity, size, colorHelper) {
        if (index >= 0 && index < this.lights.length) {
            this.removeLight(index);
            this.addLight(lightPos, targetPos, color, intensity, size, colorHelper);
        }
    }
}

export default LightManager;