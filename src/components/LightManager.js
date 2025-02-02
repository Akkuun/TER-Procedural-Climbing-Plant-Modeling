import * as THREE from 'three';

class LightManager {
    constructor(scene) {
        this.scene = scene;
        this.lights = [];
    }

    createLight(type, color, intensity) {
        switch(type) {
            case 'AmbientLight':
                return new THREE.AmbientLight(color, intensity);
            case 'DirectionalLight':
                return new THREE.DirectionalLight(color, intensity);
            case 'HemisphereLight':
                return new THREE.HemisphereLight(color, intensity);
            case 'PointLight':
                return new THREE.PointLight(color, intensity);
            case 'RectAreaLight':
                return new THREE.RectAreaLight(color, intensity);
            case 'SpotLight':
                return new THREE.SpotLight(color, intensity);
            default:
                return new THREE.DirectionalLight(color, intensity);
        }
    }

    createLightHelper(light, size, color) {
        switch(light.type) {
            case 'DirectionalLight':
                return new THREE.DirectionalLightHelper(light, size, color);
            case 'SpotLight':
                return new THREE.SpotLightHelper(light, size, color);
            default:
                return new THREE.DirectionalLightHelper(light, size, color);
        }
    }

    addLight(type = 'DirectionalLight',lightPos = { lx: 0, ly: 0, lz: 0 },
             targetPos = { tx: 0, ty: 0, tz: 0 }, color = 0xffffff,
             intensity = 1, size = 1, colorHelper = 0x000000,
             shadowParams = { shadowmapSizeWidth: 512, shadowmapSizeHeight: 512, near: 0.5, far: 500, zoom: 1 },
             mapParams = { width: 10, height: 10, bias: -0.001 }) {
        const { lx, ly, lz } = lightPos;
        const { tx, ty, tz } = targetPos;
        const { width, height, near, far, zoom } = shadowParams;

        const light = this.createLight(type,color,intensity);
        light.position.set(lx, ly, lz);
        light.size = size;

        if(type==='DirectionalLight'||type==='SpotLight') {
            light.target.position.set(tx, ty, tz);
            this.scene.add(light.target);

        }

        // shadowmap
        light.castShadow = true;
        light.shadow.camera.left = -width / 2;
        light.shadow.camera.right = width / 2;
        light.shadow.camera.top = height / 2;
        light.shadow.camera.bottom = -height / 2;
        light.shadow.mapSize.width = mapParams.shadowmapSizeWidth;
        light.shadow.mapSize.height = mapParams.shadowmapSizeHeight;
        light.shadow.bias = mapParams.bias;
        light.shadow.camera.near = near;
        light.shadow.camera.far = far;
        light.shadow.camera.zoom = zoom;

        this.scene.add(light);

        //on met une ambientlight car sinon les faces non éclairées sont noires et donc si on veux une ombre plus prononcer on desactive la light
        const ambientLight = new THREE.AmbientLight(color, intensity);
        ambientLight.name = "BLANCK";
        this.scene.add(ambientLight);

        const lightHelper = this.createLightHelper(light, size, colorHelper);
        lightHelper.name="BLANCK";
        //pour chaque enfant mettre le nom "BLANCK"
        lightHelper.children.forEach((child) => {
            child.name = "BLANCK";
        });
        this.scene.add(lightHelper);

        if(light.shadow){
            const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
            cameraHelper.name = "BLANCK";
            this.scene.add(cameraHelper);
            this.lights.push({ light, cameraHelper, lightHelper, ambientLight });
        }else{
            this.lights.push({ light, ambientLight, lightHelper });
        }

    }

    removeLight(index) {
        if (index >= 0 && index < this.lights.length) {
            const { light, ambientLight, lightHelper, cameraHelper } = this.lights[index];
            this.scene.remove(light);
            if (light.target){
                this.scene.remove(light.target);
            }
            this.scene.remove(ambientLight);
            this.scene.remove(lightHelper);
            if (cameraHelper){
                this.scene.remove(cameraHelper);
            }
            this.lights.splice(index, 1);
        }
    }

    updateLight(index, lightPos, targetPos, color, intensity, size, colorHelper, shadowParams, mapParams) {
        if (index >= 0 && index < this.lights.length) {
            const { light } = this.lights[index];
            const { lx, ly, lz } = lightPos;
            const { tx, ty, tz } = targetPos;
            const { width, height, near, far, zoom } = shadowParams;

            light.position.set(lx, ly, lz);
            if (light.target){
                light.target.position.set(tx, ty, tz);
            }
            light.color.set(color);
            light.intensity = intensity;
            light.size = size;

            if (light.shadow) {

                light.shadow.camera.left = -width / 2;
                light.shadow.camera.right = width / 2;
                light.shadow.camera.top = height / 2;
                light.shadow.camera.bottom = -height / 2;
                light.shadow.mapSize.width = mapParams.shadowmapSizeWidth;
                light.shadow.mapSize.height = mapParams.shadowmapSizeHeight;
                light.shadow.bias = mapParams.bias;
                light.shadow.camera.near = near;
                light.shadow.camera.far = far;
                light.shadow.camera.zoom = zoom;
                light.shadow.camera.updateProjectionMatrix();
            }

            this.lights[index].lightHelper.update();
            if(this.lights[index].cameraHelper){
                this.lights[index].cameraHelper.update();
            }
        }
    }
}

export default LightManager;