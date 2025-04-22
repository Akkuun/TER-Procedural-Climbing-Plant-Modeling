import { Vec3 } from "./Vec3";
import { Quat } from "./Quaternion";
import EllipsoidBody from "./EllipsoidBody";
import * as THREE from 'three';
import { SVD } from "svd-js";

function mat3Add(a: THREE.Matrix3, b: THREE.Matrix3): THREE.Matrix3 {
    return new THREE.Matrix3().set(
        a.elements[0] + b.elements[0], a.elements[1] + b.elements[1], a.elements[2] + b.elements[2],
        a.elements[3] + b.elements[3], a.elements[4] + b.elements[4], a.elements[5] + b.elements[5],
        a.elements[6] + b.elements[6], a.elements[7] + b.elements[7], a.elements[8] + b.elements[8]
    )
}

export default class ParticleGroup {
    public particles: EllipsoidBody[] = [];
    public root: number = -1; // Root particle index

    public R: THREE.Matrix3 = new THREE.Matrix3();// Optimal rotation matrix
    public A: THREE.Matrix3 = new THREE.Matrix3(); // Moment matrix

    public c: Vec3 = new Vec3(); // Center of mass (Rest)
    public c_bar: Vec3 = new Vec3(); // Center of mass in the predicted position

    public x: Vec3 = new Vec3(); // Position of the group (Rest)
    public x_bar: Vec3 = new Vec3(); // Predicted position of the group
    public x_t: Vec3 = new Vec3(); // Position of the group (Target)

    constructor(particles: EllipsoidBody[] = []) {
        this.particles = particles;
    }

    addParticle(particle: EllipsoidBody) {
        this.particles.push(particle);
    }
    removeParticle(particle: EllipsoidBody) {
        let particleToRemove = this.particles.find(p => p === particle);
        if (particleToRemove) {
            this.particles.splice(this.particles.indexOf(particleToRemove), 1);
            particleToRemove.parent = null;
            for (let i = 0; i < particleToRemove.childs.length; i++) {
                let child = particleToRemove.childs[i];
                child.parent = null;
                this.particles.splice(this.particles.indexOf(child), 1);
            }
        }
    }
    update(deltaTime: number, gravity: Vec3, externalForce: Vec3) {
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            particle.firstStep(deltaTime, gravity, externalForce);
        }
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            particle.updateGroupCenterOfMass();
        }
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            particle.updateOptimalRotationMatrix();
        }
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            particle.updateTargetPosition();
        }
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            particle.updateGoalPosition();
        }
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            particle.otherUpdates(deltaTime);
        }
    }

    updateTargetPosition() {
        // We can calculate the target position for each aprticle group as (Eq. 3)
        let xmc = this.x_bar.sub(this.c_bar);
        this.x_t = new Vec3(
            xmc.x * this.R.elements[0] + xmc.y * this.R.elements[1] + xmc.z * this.R.elements[2],
            xmc.x * this.R.elements[3] + xmc.y * this.R.elements[4] + xmc.z * this.R.elements[5],
            xmc.x * this.R.elements[6] + xmc.y * this.R.elements[7] + xmc.z * this.R.elements[8]
        ).add(this.c);
    }

    updateWeights() : number {
        let particle = this.particles[this.root];
        particle.weight = this.f(0) * particle.mass;
        return particle.weight + this.updateWeightsRec(particle, 1);
    }

    updateWeightsRec(particle: EllipsoidBody, depth: number = 0) : number {
        let depthWeight = 0;
        for (let i = 0; i < particle.childs.length; i++) {
            let child = particle.childs[i];
            child.weight = this.f(depth) * child.mass;
            depthWeight += child.weight;
            depthWeight += this.updateWeightsRec(child, depth + 1);
        }
        return depthWeight;
    }

    f(depth : number) {
        return Math.pow(0.8, depth);
    }
}