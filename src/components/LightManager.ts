import * as THREE from 'three';

export type LightParams = {
    type: string;
    lx: number;
    ly: number;
    lz: number;
    tx: number;
    ty: number;
    tz: number;
    color: number;
    intensity: number;
    size: number;
    colorHelper: number;
    width: number;
    height: number;
    near: number;
    far: number;
    zoom: number;
    shadowmapSizeWidth: number;
    shadowmapSizeHeight: number;
    bias: number;
};

// Paramètres de la lumière
export const lightParams: LightParams = {
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

class LightManager {
    scene: THREE.Scene;
    lights: Array<{
        light: THREE.Light;
        ambientLight: THREE.AmbientLight;
        lightHelper: THREE.DirectionalLightHelper | THREE.SpotLightHelper | THREE.PointLightHelper;
        cameraHelper?: THREE.CameraHelper;
    }>;
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.lights = [];
    }

    createLight(type: string, color: number, intensity: number) {
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

    createLightHelper(light: THREE.Light, size: number, color: number) : THREE.DirectionalLightHelper | THREE.SpotLightHelper | THREE.PointLightHelper | null {
        switch (light.type) {
            case 'DirectionalLight':
                if (light instanceof THREE.DirectionalLight) {
                    return new THREE.DirectionalLightHelper(light, size, color);
                }
                break;
            case 'SpotLight':
                if (light instanceof THREE.SpotLight) {
                    return new THREE.SpotLightHelper(light, color);
                }
                break;
            default:
                if (light instanceof THREE.DirectionalLight) {
                    return new THREE.DirectionalLightHelper(light, size, color);
                }
                break;
        }
        console.warn('Unsupported light type for helper:', light.type);
        return null;
    }

    addLight(lightParams: LightParams) : void {
        // Defaults for lightParams
        const {
            type = 'DirectionalLight',
            lx = 0, ly = 0, lz = 0,
            tx = 0, ty = 0, tz = 0,
            color = 0xffffff,
            intensity = 1,
            size = 1,
            colorHelper = 0x000000,
            shadowmapSizeWidth = 512,
            shadowmapSizeHeight = 512,
            near = 0.5,
            far = 500,
            zoom = 1,
            width = 10,
            height = 10,
            bias = -0.001
        } = lightParams;
    
        const light = this.createLight(type, color, intensity);
        light.position.set(lx, ly, lz);
        if ('size' in light) {
            (light as any).size = size; // Use type assertion to avoid TypeScript errors
        }
    
        if (type === 'DirectionalLight' || type === 'SpotLight') {
            if ('target' in light) {
                (light.target as THREE.Object3D).position.set(tx, ty, tz);
                this.scene.add(light.target);
            }
        }
    
        // shadowmap
        light.castShadow = true;
        if ("shadow" in light && light.shadow) {
            if ("left" in light.shadow.camera) {
                light.shadow.camera.left = -width / 2;
                light.shadow.camera.right = width / 2;
                light.shadow.camera.top = height / 2;
                light.shadow.camera.bottom = -height / 2;
            }
            light.shadow.mapSize.width = shadowmapSizeWidth;
            light.shadow.mapSize.height = shadowmapSizeHeight;
            light.shadow.bias = bias;
            light.shadow.camera.near = near;
            light.shadow.camera.far = far;
            light.shadow.camera.zoom = zoom;
        }
    
        this.scene.add(light);
    
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(color, intensity);
        ambientLight.name = "BLANCK";
        this.scene.add(ambientLight);
    
        const lightHelper = this.createLightHelper(light, size, colorHelper);
        if (lightHelper) {
            lightHelper.name = "BLANCK";
            lightHelper.children.forEach((child) => {
                child.name = "BLANCK";
            });
            this.scene.add(lightHelper);
        
            if (light.shadow) {
                const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
                cameraHelper.name = "BLANCK";
                this.scene.add(cameraHelper);
                this.lights.push({ light, ambientLight, lightHelper, cameraHelper });
            } else {
                this.lights.push({ light, ambientLight, lightHelper });
            }
        }
    }

    removeLight(index: number) : void {
        if (index >= 0 && index < this.lights.length) {
            const { light, ambientLight, lightHelper, cameraHelper } = this.lights[index];
            this.scene.remove(light);
            if ("target" in light && light.target) {
                if (light.target){
                    if (light.target instanceof THREE.Object3D) {
                        this.scene.remove(light.target);
                    }
                }
            }
            this.scene.remove(ambientLight);
            this.scene.remove(lightHelper);
            if (cameraHelper){
                this.scene.remove(cameraHelper);
            }
            this.lights.splice(index, 1);
        }
    }

    updateLight(index: number, lightParams: LightParams) : void {
        if (index >= 0 && index < this.lights.length) {
            const { light } = this.lights[index];
            const {
                lx, ly, lz,
                tx, ty, tz,
                color, intensity,
                size, colorHelper,
                shadowmapSizeWidth, shadowmapSizeHeight,
                near, far, zoom,
                width, height, bias
            } = lightParams;
    
            light.position.set(lx, ly, lz);
            if ("target" in light && light.target) {
                if (light.target) {
                    if (light.target instanceof THREE.Object3D) {
                        light.target.position.set(tx, ty, tz);
                    }
                }
            }
            light.color.set(color);
            light.intensity = intensity;
            if ("size" in light) light.size = size;
    
            if (light.shadow) {
                if ("left" in light.shadow.camera) light.shadow.camera.left = -width / 2;
                if ("right" in light.shadow.camera) light.shadow.camera.right = width / 2;
                if ("top" in light.shadow.camera) light.shadow.camera.top = height / 2;
                if ("bottom" in light.shadow.camera) light.shadow.camera.bottom = -height / 2;
                
                light.shadow.mapSize.width = shadowmapSizeWidth;
                light.shadow.mapSize.height = shadowmapSizeHeight;
                light.shadow.bias = bias;
                if ("near" in light.shadow.camera) light.shadow.camera.near = near;
                if ("far" in light.shadow.camera) light.shadow.camera.far = far;
                if ("zoom" in light.shadow.camera) light.shadow.camera.zoom = zoom;
                if (light.shadow.camera instanceof THREE.PerspectiveCamera || light.shadow.camera instanceof THREE.OrthographicCamera) {
                    light.shadow.camera.updateProjectionMatrix();
                }
            }
    
            this.lights[index].lightHelper.update();
            if (this.lights[index].cameraHelper) {
                this.lights[index].cameraHelper.update();
            }
        }
    }
}

export default LightManager;