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
export const MAX_WIDTH : number = 0.5;
export const MAX_HEIGHT : number = 1.0;

export const WIDTH_GROWTH_RATE : number = 0.2;
export const HEIGHT_GROWTH_RATE : number = 0.6;

export const DEFAULT_DIMENSIONS : THREE.Vector3 = new THREE.Vector3(
    SMALLEST_PARTICLE_FACTOR * MAX_WIDTH,
    SMALLEST_PARTICLE_FACTOR * MAX_WIDTH,
    SMALLEST_PARTICLE_FACTOR * MAX_HEIGHT,
);

export const DELTA_WIDTH : number = WIDTH_GROWTH_RATE * MAX_WIDTH;
export const DELTA_HEIGHT : number = HEIGHT_GROWTH_RATE * MAX_HEIGHT;

export const VEC_UP : THREE.Vector3 = new THREE.Vector3(0, 1, 0);

export const SURFACE_ADAPTATION_STRENGTH : number = 8;
export const PHOTOTROPISM_RESPONSE_STRENGTH : number = 2;

export const BRANCHING_PROBABILITY : number = 0.0;
export const BRANCHING_ANGLE_VARIANCE : number = Math.PI/3;

export const WIREFRAME : boolean = true;

export const STIFFNESS : number = 0.2;

const PI : number = Math.PI;
const EPSILON : number = 0.0001;

function mat3Add(a: THREE.Matrix3, b: THREE.Matrix3): THREE.Matrix3 {
    return new THREE.Matrix3().set(
        // THREE.Matrix3 is stored in column-major order
        // But Matrix3.set takes values in row-major order
        // https://threejs.org/docs/?q=matrix#api/en/math/Matrix3
        a.elements[0] + b.elements[0], a.elements[3] + b.elements[3], a.elements[6] + b.elements[6],
        a.elements[1] + b.elements[1], a.elements[4] + b.elements[4], a.elements[7] + b.elements[7],
        a.elements[2] + b.elements[2], a.elements[5] + b.elements[5], a.elements[8] + b.elements[8]
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

function matrix3To2DArray(matrix: THREE.Matrix3): number[][] {
    const elements = matrix.elements; 
    return [
        // THREE.Matrix3 is stored in column-major order
        [elements[0], elements[3], elements[6]], // Column 1
        [elements[1], elements[4], elements[7]], // Column 2
        [elements[2], elements[5], elements[8]], // Column 3
    ];
}

function getRot(axis: THREE.Vector3, angle: number): THREE.Matrix3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;

    return new THREE.Matrix3().set(
        t * axis.x * axis.x + c, t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
        t * axis.y * axis.x + s * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z - s * axis.x,
        t * axis.z * axis.x - s * axis.y, t * axis.z * axis.y + s * axis.x, t * axis.z * axis.z + c
    );
}

function polarDecomposition(A: THREE.Matrix3) : THREE.Matrix3 {
    const {u, q, v} = SVD(matrix3To2DArray(A));
    const U = new THREE.Matrix3().set(
        u[0][0], u[0][1], u[0][2],
        u[1][0], u[1][1], u[1][2],
        u[2][0], u[2][1], u[2][2]
    );
    const Vt = new THREE.Matrix3().set(
        v[0][0], v[1][0], v[2][0],
        v[0][1], v[1][1], v[2][1],
        v[0][2], v[1][2], v[2][2]
    );
    return U.multiply(Vt);
}

class Particle {
    widthLOD : number = 8;
    heightLOD : number = 4;
    scene : THREE.Scene; // Scene of the ellipsoid
    mesh : THREE.Mesh; // Mesh of the ellipsoid
    material : THREE.MeshStandardMaterial; // Material of the ellipsoid
    pointAtXRest : THREE.Points; // Point at rest position

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

    x_anchor: THREE.Vector3; // Anchor position

    c: THREE.Vector3; // Center of mass of the group
    c_rest: THREE.Vector3; // Rest Center of mass of the group

    dimensions : THREE.Vector3; // Ellipsoid dimensions

    A: THREE.Matrix3 = new THREE.Matrix3(); // Moment matrix

    Rg: THREE.Matrix3 = new THREE.Matrix3(); // Least square optimal matrix

    rho: number = 0.5; // Density of the ellipsoid

    mass: number = 1.0; // Mass of the ellipsoid
    weight: number = 1.0; // Weight of the ellipsoid, f(depth)

    childs: Particle[] = []; // Child ellipsoids
    parent: Particle | null = null; // Parent ellipsoid
    depth: number; // Depth of the ellipsoid in the hierarchy

    hasApicalChild: boolean = false; // True if the ellipsoid has an apical child
    isSeed: boolean = false; // True if the ellipsoid is the seed of the plant

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
        this.isSeed = isSeed;

        this.pointAtXRest = coordonneToObject({x:this.x_rest.x, y:this.x_rest.y, z:this.x_rest.z});

        this.pointAtXRest.material = this.material;
        this.pointAtXRest.scale.set(5, 5, 5);
        this.scene.add(this.pointAtXRest);

        this.x_anchor = this.x.clone();
    }

    stillGrowing() : boolean {
        // Check if the particle is still growing
        return this.dimensions.y < MAX_WIDTH || this.dimensions.z < MAX_HEIGHT;
    }

    selfGrowth(dt: number, octree: Octree) {
        if (!this.stillGrowing()) return;
        if (this.dimensions.x < MAX_WIDTH) {
            this.dimensions.x += DELTA_WIDTH * dt;
            this.dimensions.y += DELTA_WIDTH * dt;
        }
        if (this.dimensions.z < MAX_HEIGHT) {
            this.dimensions.z += DELTA_HEIGHT * dt;
        }
        this.updateMass();
        this.updateMomentMatrix();
        this.updateAnchor(octree);
    }

    updateAnchor(octree: Octree) {
        this.x_anchor = this.closestAnchor(this.x, octree);
    }

    rotate(angle: number, axis: THREE.Vector3) {
        // Update the particle's quaternion
        const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        this.q.premultiply(rotation);
    }
    


    updateMass() {
        this.mass = this.rho * 4*Math.PI/3 * this.dimensions.x * this.dimensions.y * this.dimensions.z;
    }

    updateMomentMatrix() {
        const mass_5 = this.mass / 5;
        this.A = new THREE.Matrix3().set(
            mass_5 * (this.dimensions.y*this.dimensions.y + this.dimensions.z*this.dimensions.z), 0, 0,
            0, mass_5 * (this.dimensions.x*this.dimensions.x + this.dimensions.z*this.dimensions.z), 0,
            0, 0, mass_5 * (this.dimensions.x*this.dimensions.x + this.dimensions.y*this.dimensions.y)
        );
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
        const geometry = new THREE.SphereGeometry(
            this.dimensions.x,
            this.widthLOD,
            this.heightLOD
        )
        this.mesh = new THREE.Mesh(
            geometry,
            this.material
        );
        geometry.translate(0 , this.dimensions.y/2, 0);
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
        if (this.hasApicalChild) return;
        if (this.dimensions.z < MAX_HEIGHT) return;
        let child = new Particle(
            this.x.clone().add(this.getDir().multiplyScalar(this.dimensions.y/2)),
            this.q.clone(),
            this.material.clone(),
            this.scene,
            this.depth + 1
        );
        child.x_rest.copy(this.x_rest).add(this.getDir().clone().multiplyScalar(this.dimensions.y/2));
        child.parent = this;
        this.childs.push(child);
        particles.push(child);
        this.hasApicalChild = true;

        this.updateParticleGroupsCentersOfMass();
        child.updateParticleGroupsCentersOfMass();
    }

    updateMesh(): void {
        this.mesh.position.copy(this.x);
        const direction = this.getDir();
        const targetPosition = this.x.clone().add(direction); // A point in the direction of `getDir`
        this.mesh.lookAt(targetPosition);
        this.mesh.updateMatrixWorld();
        this.mesh.scale.set(this.dimensions.x, this.dimensions.y, this.dimensions.z);
    }

    eulerIntegration(dt: number, gravity: THREE.Vector3, externalForces: THREE.Vector3) : void {
        this.x_goal = new THREE.Vector3(0, 0, 0);
        if (this.isSeed) {
            this.x_pred = this.x.clone();
            this.q_pred = this.q.clone();
            return;
        }
        this.x_pred = this.x.clone()
        .add(this.v.clone().addScalar(dt))
        .add(gravity.clone().add(externalForces).multiplyScalar(dt*dt/2));

        const ang_vel_length = this.w.length();
        if (ang_vel_length < EPSILON) {
            this.q_pred = this.q.clone();
            return;
        }
        const axis = this.w.clone().normalize()
            .multiplyScalar(Math.sin(ang_vel_length * dt / 2));
        const angle = Math.cos(ang_vel_length * dt / 2);
        this.q_pred = new THREE.Quaternion(
            axis.x,
            axis.y,
            axis.z,
            angle
        ).multiply(this.q);
    }

    getGroup() : Particle[] {
        let particles : Particle[] = [this];
        if (this.parent) {
            particles.push(this.parent);
        }
        for (let i = 0; i < this.childs.length; i++) {
            particles.push(this.childs[i]);
        }
        return particles;
    }

    updateParticleGroupsCentersOfMass() {
        let mass_sum = 0;
        this.c.set(0, 0, 0);
        this.c_rest.set(0, 0, 0);

        let group = this.getGroup();
        let i = 0;
        for (i = 0; i < group.length; i++) {
            this.c.add(group[i].x_pred.clone().multiplyScalar(group[i].mass));
            this.c_rest.add(group[i].x_rest.clone().multiplyScalar(group[i].mass));
            mass_sum += group[i].mass;
        }
        this.c.multiplyScalar(1/mass_sum);
        this.c_rest.multiplyScalar(1/mass_sum);
    }



    updateLeastSquareOptimalMatrix() {
        let A : THREE.Matrix3 = new THREE.Matrix3()
        .set(
            0, 0, 0,
            0, 0, 0,
            0, 0, 0
        );

        let group = this.getGroup();
        let c = group[0].c.clone();
        let c_rest = group[0].c_rest.clone();
        let M = 0;
        for (let i = 0; i < group.length; i++) {
            let particle = group[i];
            let X = new THREE.Matrix3()
            .set(
                particle.x.x * particle.x_rest.x, particle.x.x * particle.x_rest.y, particle.x.x * particle.x_rest.z,
                particle.x.y * particle.x_rest.x, particle.x.y * particle.x_rest.y, particle.x.y * particle.x_rest.z,
                particle.x.z * particle.x_rest.x, particle.x.z * particle.x_rest.y, particle.x.z * particle.x_rest.z
            )
            .multiplyScalar(particle.mass);
            M += particle.mass;
            A = mat3Add(A, X);
        }
        let C = new THREE.Matrix3()
        .set(
            c.x * c_rest.x, c.x * c_rest.y, c.x * c_rest.z,
            c.y * c_rest.x, c.y * c_rest.y, c.y * c_rest.z,
            c.z * c_rest.x, c.z * c_rest.y, c.z * c_rest.z
        )
        .multiplyScalar(M); // should be -M ? but it crashes
        A = mat3Add(A, C);

        this.Rg = polarDecomposition(A);
    }

    updateTargetPosition() {
        this.x_target = this.x_rest.clone().sub(this.c_rest).applyMatrix3(this.Rg).add(this.c);
    }

    updateGoalPosition() {
        this.x_goal = new THREE.Vector3(0, 0, 0);

        let weightsum = 0;
        let group = this.getGroup();

        for (let i = 0; i < group.length; i++) {
            let particle = group[i];
            this.x_goal.add(particle.x_target.multiplyScalar(particle.weight));
            weightsum += particle.weight;
        }

        this.x_goal.multiplyScalar(1/weightsum);
    }

    applyStiffness() {
        this.x_goal = this.x_pred.clone().add(this.x_goal.clone().sub(this.x_pred).multiplyScalar(STIFFNESS));
    }

    integrationScheme(dt: number) {
        if(this.isSeed) return;

        // n terms of orientation, we only update the orientation of the center particle by replacing it with the optimal rotation provided by shapematching.
        // "Solid Simulation with Oriented Particles" 5.1
        this.q_pred = new THREE.Quaternion(0, 0, 0, 1).setFromRotationMatrix(
            new THREE.Matrix4().set(
                this.Rg.elements[0], this.Rg.elements[3], this.Rg.elements[6], 0,
                this.Rg.elements[1], this.Rg.elements[4], this.Rg.elements[7], 0,
                this.Rg.elements[2], this.Rg.elements[5], this.Rg.elements[8], 0,
                0, 0, 0, 1
            )
        );

        // Linear velocity
        this.v = this.x_goal.clone().sub(this.x).multiplyScalar(dt);

        // Position
        this.x = this.x_goal.clone();
        

        // Angular velocity
        let r = this.q_pred.clone().multiply(this.q.invert());
        if (r.w < 0) {
            r = this.q.clone().multiply(this.q_pred.invert());
        }
        const angle = Math.acos(r.w);
        if (angle < EPSILON) {
            this.w = new THREE.Vector3(0, 0, 0);
        } else {
            const axis = new THREE.Vector3(r.x, r.y, r.z).normalize();
            this.w = axis.multiplyScalar(angle / dt);
        }

        // Rotation
        this.q = this.q_pred.clone();
    }

    applyDoubleRot(q: THREE.Quaternion, axis1: THREE.Vector3, angle1: number, axis2: THREE.Vector3, angle2: number) : THREE.Euler {
        let quaternion = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis1, angle1)).multiply(new THREE.Quaternion().setFromAxisAngle(axis2, angle2));
        return new THREE.Euler().setFromQuaternion(quaternion);
    }

    plantOrientation(dt: number, light: any) {
        if (this.hasApicalChild) return;
        // Surface adaptation
        let v_s = this.x.clone().sub(this.x_anchor).normalize();
        let v_f = this.getDir().normalize();
        let a_a = v_s.clone().cross(v_f).normalize(); // norm ??
        let alpha_a = v_s.clone().dot(v_f) * SURFACE_ADAPTATION_STRENGTH * dt;

        // Phototropism
        let v_l = light.position.clone();
        let d_l = v_l.clone().sub(this.x);

        let radial = d_l.length();
        let occlusion = 25/(radial*radial);
        d_l.normalize();

        let a_p = v_f.clone().cross(d_l).normalize();
        let alpha_p = (v_f.clone().dot(d_l) * PHOTOTROPISM_RESPONSE_STRENGTH * dt) * occlusion;
        let new_rot = this.applyDoubleRot(this.q, a_a, alpha_a, a_p, alpha_p);
        this.q.setFromEuler(new_rot);
    }
}

function applyToAllParticles(particleGroup: Particle[], func: (particle: Particle) => void) {
    for (let i = 0; i < particleGroup.length; i++) {
        func(particleGroup[i]);
    }
}


function updateParticleGroup(delta_time : number, particleGroup : Particle[], gravity : THREE.Vector3, externalForce : THREE.Vector3,
    light: any, scene: THREE.Scene, octree:any, eta: number, rootIndex : number=0) : void {
    let testing = false;
    // Testing
    if (testing) {

        return;
    }
    
    // Self growth & anchor update
    applyToAllParticles(particleGroup, (particle) => {
        particle.selfGrowth(delta_time, octree);
    });

    // Euler integration
    /*applyToAllParticles(particleGroup, (particle) => {
        particle.eulerIntegration(delta_time, gravity, externalForce);
    });

    // Update particles groups centers of mass
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateParticleGroupsCentersOfMass();
    });

    // Compute least square optimal matrices for each group
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateLeastSquareOptimalMatrix();
    });

    // Compute particle's target position
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateTargetPosition();
    });

    // Compute particle's goal position (and update weight if needed)
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateWeight();
    });
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateGoalPosition();
    });

    // Correct particle's predicted position with the goal position
    applyToAllParticles(particleGroup, (particle) => {
        particle.applyStiffness();
    });

    // Integration Scheme
    applyToAllParticles(particleGroup, (particle) => {
        particle.integrationScheme(delta_time);
    });*/

    // Correct x towards the nearest anchor

    // Surface adaptation
    // Phototropism
    applyToAllParticles(particleGroup, (particle) => {
        particle.plantOrientation(delta_time, light);
    });

    // Growth integration

    // Grow branches and childs
    applyToAllParticles(particleGroup, (particle) => {
        particle.growApicalChild(particleGroup);
    });


    // Mesh updates
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateMesh();
    });

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