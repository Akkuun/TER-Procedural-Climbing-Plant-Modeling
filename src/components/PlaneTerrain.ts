import { GROUP_GROUND, GROUP_PLANT } from "../utils/Engine";
import * as THREE from 'three';
import * as CANNON from 'cannon-es';


class PlaneTerrain {
    world : CANNON.World;
    physicsBody : CANNON.Body;
    mesh : THREE.Mesh;

    /**
     * 
     * @param {CANNON.World} world  Physics engine world
     * @param {float} width size of the square plane
     * @param {float} height Y position of the plane
     * @param {THREE.MeshStandardMaterial} material Phong material of the ellipsoid (contains the color !)
     */
    constructor(world: CANNON.World, width: number, height: number, material: THREE.MeshStandardMaterial) {
        this.world = world;
        this.physicsBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            position: new CANNON.Vec3(0, height, 0),
            quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
            collisionFilterGroup: GROUP_GROUND,
            collisionFilterMask: GROUP_PLANT
        });
        this.world.addBody(this.physicsBody);

        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, width),
            material
        );
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.copy(this.physicsBody.position);
        this.mesh.receiveShadow = true;
        this.mesh.name = "ground";
    }

    addToScene(scene: THREE.Scene) {
        scene.add(this.mesh);
    }
}

export default PlaneTerrain;