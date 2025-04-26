//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {GROUP_PLANT, GROUP_GROUND} from "../utils/Engine";
import {scene} from "../utils/Scene";
import {Vector3} from "three";
import { Octree } from "utils/Octree";
import { isObjectInShadow, isObjectInShadowWithRay } from "../utils/ObjectInShadow.js";
import { SVD } from "svd-js";
import { Quat } from "../utils/physics/Quaternion";
import { coordonneToObject } from "../utils/coordonneToObject";

export const MAX_PARTICLE_CHILDS : number = 4;
export const MAX_CONSTRAINT_ANGLE : number = Math.PI/2;
export const TWIST_ANGLE : number = Math.PI/3;
export const MAX_DISTANCE_CONSTRAINT : number = 9;

export const SMALLEST_PARTICLE_FACTOR : number = 0.1;
export const MAX_WIDTH : number = 2;
export const MAX_HEIGHT : number = 5;

export const WIDTH_GROWTH_RATE : number = 0.01;
export const HEIGHT_GROWTH_RATE : number = 0.03;

export const DEFAULT_DIMENSIONS : THREE.Vector3 = new THREE.Vector3(
    SMALLEST_PARTICLE_FACTOR * MAX_WIDTH,
    SMALLEST_PARTICLE_FACTOR * MAX_WIDTH,
    SMALLEST_PARTICLE_FACTOR * MAX_HEIGHT
);

export const DELTA_WIDTH : number = WIDTH_GROWTH_RATE * MAX_WIDTH;
export const DELTA_HEIGHT : number = HEIGHT_GROWTH_RATE * MAX_HEIGHT;

export const VEC_UP : THREE.Vector3 = new THREE.Vector3(0, 1, 0);

export const SURFACE_ADAPTATION_STRENGTH : number = 8;
export const PHOTOTROPISM_RESPONSE_STRENGTH : number = 2;

export const BRANCHING_PROBABILITY : number = 0.0;
export const BRANCHING_ANGLE_VARIANCE : number = Math.PI/3;

export const WIREFRAME : boolean = true;

const PI : number = Math.PI;
const EPSILON : number = 0.0001;

function mat3Add(a: THREE.Matrix3, b: THREE.Matrix3): THREE.Matrix3 {
    return new THREE.Matrix3().set(
        a.elements[0] + b.elements[0], a.elements[1] + b.elements[1], a.elements[2] + b.elements[2],
        a.elements[3] + b.elements[3], a.elements[4] + b.elements[4], a.elements[5] + b.elements[5],
        a.elements[6] + b.elements[6], a.elements[7] + b.elements[7], a.elements[8] + b.elements[8]
    )
}

function mat3FromQuaternion(q: THREE.Quaternion): THREE.Matrix3 {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    return new THREE.Matrix3().set(
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)
    );
}

class Particle {
    widthLOD : number = 8;
    heightLOD : number = 4;
    scene : THREE.Scene; // Scene of the ellipsoid
    mesh : THREE.Mesh; // Mesh of the ellipsoid
    material : THREE.MeshStandardMaterial; // Material of the ellipsoid

    x: THREE.Vector3; // Position
    x_prev: THREE.Vector3 | null; // Previous Position
    x_rest: THREE.Vector3; // Rest Position
    x_pred: THREE.Vector3; // Predicted Position
    x_target: THREE.Vector3; // Target Position
    x_goal: THREE.Vector3; // Goal Position

    v: THREE.Vector3; // Linear Velocity

    q: THREE.Quaternion; // Rotation
    q_prev: THREE.Quaternion | null; // Previous Rotation
    q_rest: THREE.Quaternion; // Rest Rotation
    q_pred: THREE.Quaternion; // Predicted Rotation
    R: THREE.Matrix3; // Rotation Matrix
    R_rest: THREE.Matrix3; // Rest Rotation Matrix

    w: THREE.Vector3; // Angular Velocity

    c: THREE.Vector3; // Center of mass of the group
    c_rest: THREE.Vector3; // Rest Center of mass of the group

    dimensions : THREE.Vector3; // Ellipsoid dimensions

    A: THREE.Matrix3 = new THREE.Matrix3(); // Moment matrix

    rho: number = 0.5; // Density of the ellipsoid

    mass: number = 1.0; // Mass of the ellipsoid
    weight: number = 1.0; // Weight of the ellipsoid, f(depth)

    childs: Particle[] = []; // Child ellipsoids
    parent: Particle | null = null; // Parent ellipsoid
    depth: number; // Depth of the ellipsoid in the hierarchy


    /**
     *
     * @param {THREE.Vector3} position Position of the ellipsoid's center
     * @param {THREE.Euler} rotation Rotation of the ellipsoid
     * @param {THREE.MeshPhongMaterial} material Phong material of the ellipsoid (contains the color !)
     * @param {THREE.Mesh} mesh ??
     * @param {THREE.Scene} world Physics engine world
     * @param {boolean} isSeed true if this particle is the seed of the plant, false otherwise
     */
    constructor(position: THREE.Vector3, rotation: THREE.Quaternion, material: THREE.MeshStandardMaterial, scene: THREE.Scene, depth=0, isSeed=false) {
        this.x = position.clone();
        this.x_prev = null;
        this.x_rest = position.clone();
        this.x_pred = position.clone();
        this.x_target = position.clone();
        this.x_goal = position.clone();

        this.q = rotation.clone();
        this.q_prev = null;
        this.q_rest = this.q.clone();
        this.q_pred = this.q.clone();

        this.R = mat3FromQuaternion(this.q).clone();
        this.R_rest = this.R.clone();

        this.v = new THREE.Vector3(0, 0, 0);
        this.w = new THREE.Vector3(0, 0, 0);

        this.c = position.clone();
        this.c_rest = position.clone();

        this.dimensions = DEFAULT_DIMENSIONS.clone();

        this.scene = scene;
        this.material = material;
        this.material.wireframe = WIREFRAME;
        this.mesh = new THREE.Mesh();
        this.createMesh();
        this.mesh.visible = true;
        this.scene.add(this.mesh);

        this.depth = depth;
    }

    rotate(angle: number, axis: THREE.Vector3) {
        this.q.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
        this.R = mat3FromQuaternion(this.q);
        for (let i = 0; i < this.childs.length; i++) {
            this.childs[i].rotate(angle, axis);
        }
    }

    updateMass() {
        this.mass = this.rho * 4*Math.PI/3 * this.dimensions.x * this.dimensions.y * this.dimensions.z;
    }

    updateMomentMatrix() {

    }

    updateWeight() {
        this.weight = this.f(this.depth) * this.mass;
        this.material.color.setHSL(1-this.f(this.depth), 1, 0.5);
    }

    f(depth: number) : number {
        return Math.pow(0.95, depth);
    }

    closestAnchor(position: THREE.Vector3, octree: Octree) : THREE.Vector3 {
        const closestTriangle = octree.getClosestTriangleFromPoint(position);
        return new THREE.Vector3(
            (closestTriangle.a.x + closestTriangle.b.x + closestTriangle.c.x) / 3,
            (closestTriangle.a.y + closestTriangle.b.y + closestTriangle.c.y) / 3,
            (closestTriangle.a.z + closestTriangle.b.z + closestTriangle.c.z) / 3
        );
    }
    
    createMesh() {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(
                this.dimensions.x,
                this.widthLOD,
                this.heightLOD
            ),
            this.material
        );
        this.mesh.position.set(this.x.x, this.x.y, this.x.z);
        this.mesh.quaternion.copy(this.q);
        this.mesh.scale.set(this.dimensions.x, this.dimensions.y, this.dimensions.z);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.mesh.visible = true;
        this.mesh.updateMatrixWorld();
    }

    getDir() : THREE.Vector3 {
        return new THREE.Vector3(0, 1, 0).applyQuaternion(this.q).normalize();
    }

    getHead() : THREE.Vector3 {
        return this.x.clone().add(this.getDir().multiplyScalar(this.dimensions.y));
    }

    isStillGrowing() : boolean {
        return this.dimensions.x < MAX_WIDTH || this.dimensions.y < MAX_HEIGHT;
    }

    growApicalChild(particles: Particle[]) : void {
        let child = new Particle(
            this.x.clone().add(this.getDir().multiplyScalar(this.dimensions.y)),
            this.q.clone(),
            this.material,
            this.scene,
            this.depth + 1
        );
        child.parent = this;
        this.childs.push(child);
        particles.push(child);
    }

    updateMesh(): void {
        this.mesh.position.copy(this.x);
        const direction = this.getDir();
        const targetPosition = this.x.clone().add(direction); // A point in the direction of `getDir`
        this.mesh.lookAt(targetPosition);
        this.mesh.updateMatrixWorld();
    }
}

function updateParticleGroup(delta_time : number, particleGroup : Particle[], gravity : THREE.Vector3, externalForce : THREE.Vector3,
    light: any, scene: THREE.Scene, octree:any, eta: number, rootIndex : number=0) : void {
    let testing = true;
    // Testing
    if (testing) {
        for (let i = 0; i < particleGroup.length; i++) {
            let particle = particleGroup[i];
            particle.updateMesh();
        }
        return;
    }

    
    // Self growth

    // Euler integration

    // Update particles groups

    // Compute least square optimal matrices for each group

    // Compute particle's target position

    // Compute particle's goal position (and update weight if needed)

    // Correct particle's predicted position with the goal position

    // Integration Scheme

    // Correct x towards the nearest anchor

    // Grow branches and childs

    // Surface adaptation

    // Phototropism

    // Growth integration


}

function particleRope(scene: THREE.Scene, size=10) : Particle[] {
    let particles: Particle[] = [];
    let root = new Particle(
        new THREE.Vector3(
            0,
            0,
            0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
        new THREE.MeshStandardMaterial({
            color: 0xff2233
        }), scene, 0, true
    );
    particles.push(root);
    for (let i = 0; i < size; i++) {
        let particle = particles[particles.length - 1];
        particle.growApicalChild(particles);
    }
    return particles;
}

function horizontalParticleRope(scene: THREE.Scene, size=10) : Particle[] {
    let particles: Particle[] = [];
    let root = new Particle(
        new THREE.Vector3(
            1,
            0,
            1),
        new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0, Math.PI/2) // horizontal
        ),
        new THREE.MeshStandardMaterial({
            color: 0x22ff33
        }), scene, 0, true
    );
    particles.push(root);
    for (let i = 0; i < size; i++) {
        let particle = particles[particles.length - 1];
        particle.growApicalChild(particles);
    }
    return particles;
}

/*

export function particleTree(scene, world, depth) {
    let particles = [];
    let particule = new Particule(0.5, 32, 16,
        new THREE.Vector3(0, 0, 0),
        new THREE.Euler(0, 0, 0),
        new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        }), new THREE.Mesh(), world, 2, true);
    particule.createEllipsoid();
    scene.add(particule.mesh);
    particles.push(particule);

    let needsChilds = [particule];
    for (let i = 0; i < depth; i++) {
        let newNeedsChilds = [];
        for (const parent of needsChilds) {
            let numberOfChilds = Math.floor(Math.random() * 3) + 1;
            if (numberOfChilds !== 1) {
                numberOfChilds = Math.floor(Math.random() * 3) + 1;
            }
            for (let j = 0; j < numberOfChilds; j++) {
                const child = new Particule(0.5, 32, 16,
                    new THREE.Vector3(
                        Math.random() * 1 - .5,
                        parent.lengthY * 1.8,
                        Math.random() * 1 - .5),
                    new THREE.Euler(
                        0,
                        0,
                        0),
                    new THREE.MeshPhongMaterial({
                        color: Math.random() * 0xffffff
                    }), new THREE.Mesh(), world, 2);
                parent.addChildParticle(child);
                child.createEllipsoid();
                scene.add(child.mesh);
                particles.push(child);
                newNeedsChilds.push(child);
            }
        }
        needsChilds = newNeedsChilds;
    }
    return particles;
}

*/

export { Particle, updateParticleGroup, particleRope, horizontalParticleRope };