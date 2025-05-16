import GUI from 'lil-gui';
import DimensionGUIHelper from '../utils/DimensionGUIHelper.js';
import MinMaxGUIHelper from '../utils/MinMaxGUIHelper.js';
import { OCTREE_VISIBLE } from '../utils/OctreeHelper.js';
import { controlsParams } from '../utils/Controls';

export function setupLightGUI(lightsManager, lightParams, updateLight, updateCamera, updateOctree) {
    const gui = new GUI({ container: document.getElementById('gui-container') });

    const plantFolder = gui.addFolder('Plant Parameters');
    // plantSeedEnabled is a bool
    plantFolder.add(controlsParams, "plantSeedMode").name("plantSeedEnabled").onChange(function(value) {
        // Explicitly set the value and log to verify
        controlsParams.plantSeedMode = value;
        console.log("Plant Seed Mode updated:", controlsParams.plantSeedMode);
    });
    plantFolder.open();

    const lightFolder = gui.addFolder('Light Position');
    lightFolder.add(lightParams, 'lx', -50, 50).onChange(updateLight);
    lightFolder.add(lightParams, 'ly', -50, 50).onChange(updateLight);
    lightFolder.add(lightParams, 'lz', -50, 50).onChange(updateLight);
    lightFolder.add(lightParams, 'intensity', 0, 10).onChange(updateLight);
    lightFolder.open();

    const targetFolder = gui.addFolder('Target Position');
    targetFolder.add(lightParams, 'tx', -50, 50).onChange(updateLight);
    targetFolder.add(lightParams, 'ty', -50, 50).onChange(updateLight);
    targetFolder.add(lightParams, 'tz', -50, 50).onChange(updateLight);
    targetFolder.open();

    const shadowFolder = gui.addFolder('Shadow Parameters');
    shadowFolder.add(new DimensionGUIHelper(lightsManager.lights[0].light.shadow.camera, 'left', 'right'), 'value', 1, 100)
        .name('width')
        .onChange(updateCamera);
    shadowFolder.add(new DimensionGUIHelper(lightsManager.lights[0].light.shadow.camera, 'bottom', 'top'), 'value', 1, 100)
        .name('height')
        .onChange(updateCamera);
    shadowFolder.add(lightsManager.lights[0].light.shadow, 'bias', -0.01, 0.01, 0.0001).name('bias');
    shadowFolder.add(lightsManager.lights[0].light.shadow.mapSize, 'width', 128, 8192, 128).name('mapSize width').onChange(updateCamera);
    shadowFolder.add(lightsManager.lights[0].light.shadow.mapSize, 'height', 128, 8192, 128).name('mapSize height').onChange(updateCamera);
    const minMaxGUIHelper = new MinMaxGUIHelper(lightsManager.lights[0].light.shadow.camera, 'near', 'far', 0.1);
    shadowFolder.add(minMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    shadowFolder.add(minMaxGUIHelper, 'max', 0.1, 50, 0.1).name('far').onChange(updateCamera);
    shadowFolder.add(lightsManager.lights[0].light.shadow.camera, 'zoom', 0.01, 1.5, 0.01).onChange(updateCamera);
    shadowFolder.open();

    const octreeFolder = gui.addFolder('Octree Parameters');
    octreeFolder.add(OCTREE_VISIBLE, "value").name("visible").onChange(updateOctree);
}