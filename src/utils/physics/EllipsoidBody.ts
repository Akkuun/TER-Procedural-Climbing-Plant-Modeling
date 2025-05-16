

import { Quat } from "./Quaternion";
import { Mat3 } from "math/Mat3";
import * as THREE from 'three';
import { SVD } from "svd-js";
import Particle from "../../components/Particle";

function mat3Add(a: THREE.Matrix3, b: THREE.Matrix3): THREE.Matrix3 {
    return new THREE.Matrix3().set(
        a.elements[0] + b.elements[0], a.elements[1] + b.elements[1], a.elements[2] + b.elements[2],
        a.elements[3] + b.elements[3], a.elements[4] + b.elements[4], a.elements[5] + b.elements[5],
        a.elements[6] + b.elements[6], a.elements[7] + b.elements[7], a.elements[8] + b.elements[8]
    )
}

export default class EllipsoidBody {
    dimensions: THREE.Vector3 = new THREE.Vector3(); // Dimensions of the ellipsoid
    x_rest: THREE.Vector3; // Position
    x_pred: THREE.Vector3 = new THREE.Vector3(); // Predicted position
    x_goal: THREE.Vector3 = new THREE.Vector3(); // Final goal position
    velocity: THREE.Vector3 = new THREE.Vector3(); // Velocity

    q_rest: Quat = new Quat(); // Orientation
    q_pred: Quat = new Quat(); // Predicted orientation
    angular_velocity: THREE.Vector3 = new THREE.Vector3(); // Angular velocity

    Ri: THREE.Matrix3 = new THREE.Matrix3(); // Rotation matrix
    Ai: THREE.Matrix3 = new THREE.Matrix3(); // Moment matrix

    Rgroup: THREE.Matrix3 = new THREE.Matrix3(); // Group optmal rotation matrix
    Agroup: THREE.Matrix3 = new THREE.Matrix3(); // Group moment matrix
    gc: THREE.Vector3 = new THREE.Vector3(); // Group center of mass
    gc_bar: THREE.Vector3 = new THREE.Vector3(); // Group center of mass rest
    gx_t: THREE.Vector3 = new THREE.Vector3(); // Group target position

    mass: number = 1; // Mass of the ellipsoid
    weight: number = 0; // Weight of the ellipsoid, f(depth)

    childs: EllipsoidBody[] = []; // Child ellipsoids
    parent: EllipsoidBody | null = null; // Parent ellipsoid
    depth: number = 0; // Depth of the ellipsoid in the hierarchy

    constructor(dimensions: THREE.Vector3, posX: number, posY: number, posZ: number) {
        this.updateDimensions(dimensions);

        this.x_rest = new THREE.Vector3(posX, posY, posZ);
        this.updateWeight();
        //console.log("Ellipsoid created with dimensions: ", this.dimensions);
        console.log("  Ellipsoid created with position: ", this.x_rest.x + ", " + this.x_rest.y + ", " + this.x_rest.z);
        console.log("  Ellipsoid created with argument position: ", posX, posY, posZ);
        
    }

    updateDimensions(newDimensions: THREE.Vector3) {
        this.dimensions.copy(newDimensions);
        this.mass = 4*Math.PI/3 * this.dimensions.x * this.dimensions.y * this.dimensions.z; // (Eq. 2)
        let coeff = this.mass / 5.0;
        this.Ri = new THREE.Matrix3().set(
            1-2*this.q_pred.y*this.q_pred.y-2*this.q_pred.z*this.q_pred.z, 2*this.q_pred.x*this.q_pred.y-2*this.q_pred.w*this.q_pred.z, 2*this.q_pred.x*this.q_pred.z+2*this.q_pred.w*this.q_pred.y,
            2*this.q_pred.x*this.q_pred.y+2*this.q_pred.w*this.q_pred.z, 1-2*this.q_pred.x*this.q_pred.x-2*this.q_pred.z*this.q_pred.z, 2*this.q_pred.y*this.q_pred.z-2*this.q_pred.w*this.q_pred.x,
            2*this.q_pred.x*this.q_pred.z-2*this.q_pred.w*this.q_pred.y, 2*this.q_pred.y*this.q_pred.z+2*this.q_pred.w*this.q_pred.x, 1-2*this.q_pred.x*this.q_pred.x-2*this.q_pred.y*this.q_pred.y
        );
        this.Ai = new THREE.Matrix3().set(
            coeff * (this.dimensions.x*this.dimensions.x), 0, 0,
            0, coeff * (this.dimensions.y*this.dimensions.y), 0,
            0, 0, coeff * (this.dimensions.z*this.dimensions.z)
        ).multiply(this.Ri);
    }

    firstStep(deltaTime: number, gravity: THREE.Vector3, externalForce: THREE.Vector3) {
        
        if (isNaN(this.getX().x) || isNaN(this.getX().y) || isNaN(this.getX().z)) {
            throw new Error("EllipsoidBody position became NaN: " + this.x_rest.toString());
        }
        // In the first step we compute a predicted position x_p for all particles (Eq. 1)
        this.predictPosition(deltaTime, gravity, externalForce);
        // The predicted orientation q_p for each particle can be computed through an Explicit Euler integration (Eq. 16)
        this.predictOrientation(deltaTime);
    }

    predictPosition(deltaTime: number, gravity: THREE.Vector3, externalForce: THREE.Vector3) {
        this.x_pred = this.x_rest.clone()
        .add(this.velocity.clone().multiplyScalar(deltaTime))
        .add(gravity.clone().add(externalForce).multiplyScalar(deltaTime*deltaTime/2));
    }

    predictOrientation(deltaTime: number) {
        let angular_velocity_norm = this.angular_velocity.length() * deltaTime / 2.0;
        let firstTerm = this.angular_velocity.clone().multiplyScalar(Math.sin(angular_velocity_norm));
        let secondTerm = Math.cos(angular_velocity_norm);
        this.q_pred = this.q_rest.clone().multiply(
            new Quat(
                firstTerm.x,
                firstTerm.y,
                firstTerm.z,
                secondTerm
            )
        );
    }

    getAdjacentGroup() : EllipsoidBody[] {
        let adjacentGroups: EllipsoidBody[] = [];
        for (let i = 0; i < this.childs.length; i++) {
            let child = this.childs[i];
            if (child.parent == this) {
                adjacentGroups.push(child);
            }
        }
        if (this.parent) {
            let parent = this.parent;
            if (parent.childs.includes(this)) {
                adjacentGroups.push(parent);
            }
        }
        return adjacentGroups;
    }

    updateGroupCenterOfMass() {
        this.gc = new THREE.Vector3(0, 0, 0);
        this.gc_bar = new THREE.Vector3(0, 0, 0);
        let mass_sum = 0;
        let adjacentGroup : EllipsoidBody[] = this.getAdjacentGroup();
        for (let i = 0; i < adjacentGroup.length; i++) {
            this.gc.add(adjacentGroup[i].x_rest.multiplyScalar(adjacentGroup[i].mass));
            this.gc_bar.add(adjacentGroup[i].x_pred.multiplyScalar(adjacentGroup[i].mass));
            mass_sum += adjacentGroup[i].mass;
        } //TODO seems sus
        this.gc.multiplyScalar(1/mass_sum);
        this.gc_bar.multiplyScalar(1/mass_sum);
    }

    updateOptimalRotationMatrix() {
        let adjacentGroup : EllipsoidBody[] = this.getAdjacentGroup();
        // The dreaded (Eq. 14)
        // The total moment matrix A is computed :
        this.Agroup = new THREE.Matrix3().set(
            0, 0, 0,
            0, 0, 0,
            0, 0, 0
        );
        for (let i = 0; i < adjacentGroup.length; i++) {
            let particle = adjacentGroup[i];
            let xsmi = new THREE.Matrix3().set(
                particle.x_pred.x * particle.x_rest.x, particle.x_pred.y * particle.x_rest.x, particle.x_pred.z * particle.x_rest.x,
                particle.x_pred.x * particle.x_rest.y, particle.x_pred.y * particle.x_rest.y, particle.x_pred.z * particle.x_rest.y,
                particle.x_pred.x * particle.x_rest.z, particle.x_pred.y * particle.x_rest.z, particle.x_pred.z * particle.x_rest.z
            ).multiplyScalar(particle.mass);
            let csmi = new THREE.Matrix3().set(
                particle.gc.x * particle.gc_bar.x, particle.gc.y * particle.gc_bar.x, particle.gc.z * particle.gc_bar.x,
                particle.gc.x * particle.gc_bar.y, particle.gc.y * particle.gc_bar.y, particle.gc.z * particle.gc_bar.y,
                particle.gc.x * particle.gc_bar.z, particle.gc.y * particle.gc_bar.z, particle.gc.z * particle.gc_bar.z
            ).multiplyScalar(-particle.mass);
            this.Agroup = mat3Add(this.Agroup, particle.Ai);
            this.Agroup = mat3Add(this.Agroup, xsmi);
            this.Agroup = mat3Add(this.Agroup, csmi);
        }

        // Now we need to find R, which is computed through SVD 
        const matrix3To2DArray = (elements: THREE.Matrix3["elements"]): number[][] => {
            return [
                [elements[0], elements[1], elements[2]],
                [elements[3], elements[4], elements[5]],
                [elements[6], elements[7], elements[8]],
            ];
        };

        const matrix2D = matrix3To2DArray(this.Agroup.elements);
        let { u, q, v } = SVD(matrix2D);
        let U = new THREE.Matrix3().set(
            u[0][0], u[0][1], u[0][2],
            u[1][0], u[1][1], u[1][2],
            u[2][0], u[2][1], u[2][2]
        );
        let Vt = new THREE.Matrix3().set(
            v[0][0], v[1][0], v[2][0],
            v[0][1], v[1][1], v[2][1],
            v[0][2], v[1][2], v[2][2]
        );
        this.Rgroup = U.multiply(Vt);
    }

    updateTargetPosition() {
        // We can calculate the target position for each aprticle group as (Eq. 3)
        let xmc = this.x_rest.sub(this.gc_bar);
        this.gx_t = new THREE.Vector3(
            xmc.x * this.Rgroup.elements[0] + xmc.y * this.Rgroup.elements[1] + xmc.z * this.Rgroup.elements[2],
            xmc.x * this.Rgroup.elements[3] + xmc.y * this.Rgroup.elements[4] + xmc.z * this.Rgroup.elements[5],
            xmc.x * this.Rgroup.elements[6] + xmc.y * this.Rgroup.elements[7] + xmc.z * this.Rgroup.elements[8]
        ).add(this.gc);
    }

    updateGoalPosition() {
        this.x_goal = new THREE.Vector3(0, 0, 0);
        let adjacentGroup : EllipsoidBody[] = this.getAdjacentGroup();
        let W = 0;
        for (let i = 0; i < adjacentGroup.length; i++) {
            let particle = adjacentGroup[i];
            this.x_goal.add(particle.gx_t.multiplyScalar(particle.weight));
            W += particle.weight;
        }
        this.x_goal = this.x_goal.multiplyScalar(1/W);
    }

    otherUpdates(delta_time: number) {
        this.velocity = this.x_pred.sub(this.x_rest).multiplyScalar(delta_time); // (Eq. 17)

        this.x_rest = this.x_goal.clone(); // (Eq. 18)

        // angularvel is axis(q_p q^-1) dot angle(q_p q^-1) / delta_time (Eq. 19)
        let qpqi = this.q_pred.clone().multiply(this.q_rest.conjugate());
        let axisNorm = new THREE.Vector3(qpqi.x, qpqi.y, qpqi.z).normalize();
        let angleNorm = Math.acos(qpqi.w);
        this.angular_velocity = axisNorm.multiplyScalar(angleNorm).multiplyScalar(1.0/delta_time);

        this.q_rest = this.q_pred.clone(); // (Eq. 20)
    }

    updateDepth() {
        if (this.parent) {
            this.depth = this.parent.depth + 1;
        } else {
            this.depth = 0;
        }
    }

    updateWeight() {
        this.weight = this.f(this.depth) * this.mass;
    }

    f(depth: number) : number {
        return Math.pow(0.8, depth);
    }
    // define get and set for this.x
    getX() : THREE.Vector3 {
        return this.x_rest;
    }
    setX(x: THREE.Vector3) {
        this.x_rest = x.clone();
    }
    
}

function updateParticleGroup(delta_time : number, particleGroup : Particle[], gravity : THREE.Vector3, externalForce : THREE.Vector3) {
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.ellipsoidBody.firstStep(delta_time, gravity, externalForce);
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.ellipsoidBody.updateGroupCenterOfMass();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.ellipsoidBody.updateOptimalRotationMatrix();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.ellipsoidBody.updateTargetPosition();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.ellipsoidBody.updateGoalPosition();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.ellipsoidBody.otherUpdates(delta_time);
    }



}

export { EllipsoidBody, updateParticleGroup };



