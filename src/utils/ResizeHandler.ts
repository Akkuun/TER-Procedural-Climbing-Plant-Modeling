import { PerspectiveCamera, WebGLRenderer } from "three";

export function handleResize(camera: PerspectiveCamera, renderer: WebGLRenderer) {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
