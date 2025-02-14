import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export function setupControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true; // Ajoute un amortissement pour une meilleure expérience utilisateur
    controls.dampingFactor = 0.05;
}