import { noise3 } from "../utils/Noise";
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export default class NoiseTerrain {
    constructor(world, width = 50, depth = 50, maxHeight = 10, scale = 0.1) {
        this.world = world; // Cannon-es world
        this.width = width; // Width of the terrain (number of segments)
        this.depth = depth; // Depth of the terrain (number of segments)
        this.maxHeight = maxHeight; // Maximum height of the terrain
        this.scale = scale; // Noise scale

        this.geometry = null;
        this.mesh = null;
        this.body = null;

        this.createTerrain();
    }

    // Generate height based on noise3
    generateHeight(x, z) {
        return noise3(x * this.scale, 0, z * this.scale) * this.maxHeight;
    }

    // Create Three.js terrain and Cannon-es physics body
    createTerrain() {
        const geometry = new THREE.PlaneGeometry(this.width, this.depth, this.width - 1, this.depth - 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0x88cc88,
            wireframe: false,
            side: THREE.DoubleSide,
        });

        // Displace vertices using noise
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            positions[i + 1] = this.generateHeight(x, z); // Set y position based on noise
        }

        geometry.computeVertexNormals();

        // Create Three.js mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
        this.mesh = mesh;

        // Create Cannon-es heightfield
        const shape = this.createHeightfield(geometry);
        const body = new CANNON.Body({ mass: 0 }); // Static body
        body.addShape(shape);
        body.position.set(0, 0, 0);
        this.world.addBody(body);
        this.body = body;
    }

    // Create a heightfield shape for Cannon-es
    createHeightfield(geometry) {
        const positions = geometry.attributes.position.array;
        const rows = this.width;
        const cols = this.depth;

        // Convert positions into a 2D height map
        const heights = [];
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                const index = (i * cols + j) * 3 + 1; // Get Y coordinate
                row.push(positions[index]);
            }
            heights.push(row);
        }

        const shape = new CANNON.Heightfield(heights, {
            elementSize: this.width / (cols - 1),
        });
        return shape;
    }

    addToScene(scene) {
        scene.add(this.mesh);
    }
}