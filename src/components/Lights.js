import * as THREE from 'three';

export function addLights(scene, lightPos={lx:0,ly:0,lz:0}, targetPos={tx:0,ty:0,tz:0}, color=0xffffff, intensity=1, size=1, colorHelper=0x000000) {
    const { lx, ly, lz } = lightPos;
    const { tx, ty, tz } = targetPos;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(lx, ly, lz);
    light.target.position.set(tx, ty, tz);
    light.size = size;

    //shadowmap
    light.castShadow = true;
    // light.shadow.mapSize.width = 512;
    // light.shadow.mapSize.height = 512;
    // light.shadow.camera.near = 0.5;
    // light.shadow.camera.far = 500;

    scene.add(light);
    scene.add(light.target);

    const ambientLight = new THREE.AmbientLight(color, intensity);
    scene.add(ambientLight);

    const lightHelper = new THREE.DirectionalLightHelper(light, size, colorHelper);
    scene.add(lightHelper);

    const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
    scene.add(cameraHelper);

}


