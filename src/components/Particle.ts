//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {GROUP_PLANT, GROUP_GROUND} from "../utils/Engine";
import {scene} from "../utils/Scene";
import {Vector3} from "three";
import { Octree } from "utils/Octree";
import { isObjectInShadow, isObjectInShadowWithRay } from "../utils/ObjectInShadow.js";
import { Vec3 } from "../utils/physics/Vec3";
import { SVD } from "svd-js";
import { Quat } from "../utils/physics/Quaternion";

export const MAX_PARTICLE_CHILDS : number = 4;
export const MAX_CONSTRAINT_ANGLE : number = Math.PI/2;
export const TWIST_ANGLE : number = Math.PI/3;
export const MAX_DISTANCE_CONSTRAINT : number = 9;

export const MIN_WIDTH : number = 0.25;
export const MAX_WIDTH : number = 1.0;
export const MIN_HEIGHT : number = 0.5;
export const MAX_HEIGHT : number = 2.0;

const PI : number = Math.PI;
const EPSILON : number = 0.0001;

function mat3Add(a: THREE.Matrix3, b: THREE.Matrix3): THREE.Matrix3 {
    return new THREE.Matrix3().set(
        a.elements[0] + b.elements[0], a.elements[1] + b.elements[1], a.elements[2] + b.elements[2],
        a.elements[3] + b.elements[3], a.elements[4] + b.elements[4], a.elements[5] + b.elements[5],
        a.elements[6] + b.elements[6], a.elements[7] + b.elements[7], a.elements[8] + b.elements[8]
    )
}

class Particle {
    //radius: the radius of the ellipsoid
    //widthSegments: the number of horizontal segments
    //heightSegments: the number of vertical segments
    //color: the color of the ellipsoid
    //position: the position of the ellipsoid
    //rotation: the rotation of the ellipsoid
    //material: the material of the ellipsoid
    //mesh: the mesh of the ellipsoid
    //constructor: the constructor of the class

    /*

    const ellipsoidGeometry = new THREE.SphereGeometry(0.5, 32, 16);
    ellipsoidGeometry.rotateZ(Math.PI/2);
    ellipsoidGeometry.scale(2, 1, 1);
    const ellipsoidMesh = new THREE.Mesh(ellipsoidGeometry, new THREE.MeshPhongMaterial({color: 0x00ff00}));

     */

    widthLOD : number = 32;
    heightLOD : number = 16;
    age : number = 0.0;
    position : THREE.Vector3 = new THREE.Vector3();
    rotation : THREE.Euler = new THREE.Euler();
    material : THREE.MeshPhongMaterial;
    mesh : THREE.Mesh = new THREE.Mesh();
    vf : THREE.Vector3 = new THREE.Vector3(); // current forward vector of the particle
    vs : THREE.Vector3 = new THREE.Vector3(); // the closest vector pointing tower the surface
    phi : number = 0.5; // user defined parameter representing the adaption strength
    delta_t : number = 0.0; // the time step of the simulation
    a_a : THREE.Vector3 = new THREE.Vector3(0,0,0); // the axis
    alpha_a : number = 0.001; // rotational angle

    a_p : THREE.Vector3 = new THREE.Vector3(1,0,0); // the axis
    alpha_p : number = 0.0; // rotational angle
    R : THREE.Matrix4 = new THREE.Matrix4().identity();
    R_bar : THREE.Matrix4 = new THREE.Matrix4().identity();


    // Physics engine
    parentParticle : Particle | null = null; // The parent particle of this particle
    childParticles : Particle[] = []; // The child particles of this particle
    constraints : CANNON.Constraint[] = []; // The constraints of this particle

    dimensions: THREE.Vector3; // Dimensions of the ellipsoid
    x_rest: THREE.Vector3; // Position
    x_pred: THREE.Vector3 = new THREE.Vector3(); // Predicted position
    x_goal: THREE.Vector3 = new THREE.Vector3(); // Final goal position
    velocity: THREE.Vector3 = new THREE.Vector3(); // Velocity

    q_current: Quat = new Quat(); // Orientation
    q_pred: Quat = new Quat(); // Predicted orientation
    angular_velocity: THREE.Vector3 = new THREE.Vector3(); // Angular velocity

    Ri: THREE.Matrix3 = new THREE.Matrix3(); // Rotation matrix
    Ai: THREE.Matrix3 = new THREE.Matrix3(); // Moment matrix

    Rgroup: THREE.Matrix3 = new THREE.Matrix3(); // Group optmal rotation matrix
    Agroup: THREE.Matrix3 = new THREE.Matrix3(); // Group moment matrix
    gc: THREE.Vector3 = new THREE.Vector3(); // Group center of mass
    gc_bar: THREE.Vector3 = new THREE.Vector3(); // Group center of mass rest
    gx_t: THREE.Vector3 = new THREE.Vector3(); // Group target position

    Rg : THREE.Matrix4 = new THREE.Matrix4(); // Rotation matrix

    mass: number = 1; // Mass of the ellipsoid
    weight: number = 0; // Weight of the ellipsoid, f(depth)

    childs: Particle[] = []; // Child ellipsoids
    parent: Particle | null = null; // Parent ellipsoid
    depth: number = 0; // Depth of the ellipsoid in the hierarchy

    /**
     *
     * @param {THREE.Vector3} position Position of the ellipsoid's center
     * @param {THREE.Euler} rotation Rotation of the ellipsoid
     * @param {THREE.MeshPhongMaterial} material Phong material of the ellipsoid (contains the color !)
     * @param {THREE.Mesh} mesh ??
     * @param {CANNON.World} world Physics engine world
     * @param {boolean} isSeed true if this particle is the seed of the plant, false otherwise
     */
    constructor(position: THREE.Vector3, rotation: THREE.Euler, material: THREE.MeshPhongMaterial, world: any, isSeed=false) {
        let posclone: THREE.Vector3 = position.clone();
        this.position = new THREE.Vector3(posclone.x, posclone.y, posclone.z);
        this.rotation = new THREE.Euler(rotation.x, rotation.y, rotation.z);
        this.q_current = new Quat(
            Math.sin(rotation.x/2),
            Math.sin(rotation.y/2),
            Math.sin(rotation.z/2),
            Math.cos(rotation.x/2) * Math.cos(rotation.y/2) * Math.cos(rotation.z/2) + Math.sin(rotation.x/2) * Math.sin(rotation.y/2) * Math.sin(rotation.z/2)
        );
        this.material = material;

        console.log("Particle created at position: ", position);
        this.dimensions = new THREE.Vector3(MIN_WIDTH, MIN_HEIGHT, MIN_WIDTH);
        this.updateDimensions(this.dimensions);

        this.x_rest = new THREE.Vector3(posclone.x, posclone.y, posclone.z);
        this.updateWeight();
        // Physics engine
        
        this.createEllipsoid();
        this.update();
    }

    updateDimensionsBasedOnAge() : void {
        const width = THREE.MathUtils.lerp(MIN_WIDTH, MAX_WIDTH, Math.log(this.age + 1) / Math.log(10));
        const height = THREE.MathUtils.lerp(MIN_HEIGHT, MAX_HEIGHT, Math.log(this.age + 1) / Math.log(10));
        this.dimensions = new THREE.Vector3(width, height, width);
    }

    createEllipsoid() : void {
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, this.widthLOD, this.heightLOD), this.material);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        this.mesh.quaternion.setFromEuler(this.rotation);
        // Cylinder heights follows the y-axis on the physics body so we need to match this here
        this.mesh.scale.set(this.dimensions.x, this.dimensions.y, this.dimensions.z);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
    }

    /**
     * Updates the position and quaternion of the mesh based on the physics body
     */
    update() : void {
        // Copy the position and quaternion of the physics body to the mesh at each update

    }

    updateEllipsoidBody() {
        this.mesh.position.copy(this.position);
        this.mesh.quaternion.copy(this.q_current);
    }


    /**
     *
     * @returns the attach point of the parent particle (the bottom of the ellipsoid)
     */
    getParentAttachPoint() : CANNON.Vec3 {
        return new CANNON.Vec3(0, -this.dimensions.y, 0);
    }

    /**
     *
     * @returns the attach point of the child particle (the top of the ellipsoid)
     */
    getChildAttachPoint() : CANNON.Vec3 {
        return new CANNON.Vec3(0, this.dimensions.y, 0);
    }

    setParentParticle(parentParticle : Particle) : void {
        this.parentParticle = parentParticle;
    }

    getParentParticle() : Particle | null {
        return this.parentParticle;
    }

    /**
     * Adds a child particle to the particle.
     * @param {Particule} childParticle
     * @returns true if the child particle was added successfully, false otherwise
     */
    addChildParticle(childParticle: Particle) : boolean {
        if (this.childParticles.length < MAX_PARTICLE_CHILDS - 1) {
            this.childParticles.push(childParticle);
            childParticle.setParentParticle(this);
            // let constraint = new CANNON.PointToPointConstraint(
            //     this.physicsBody,
            //     this.getChildAttachPoint(),
            //     childParticle.physicsBody,
            //     childParticle.getParentAttachPoint()
            // );
            this.childs.push(childParticle);
            childParticle.parent = this;
            return true;
        }
        return false;
    }

    /**
     * Removes a child particle from the particle
     * @param {Particule} childParticle 
     * @returns true if the child particle was removed successfully, false otherwise
     */
    removeChildParticle(childParticle: Particle) : boolean {
        const index = this.childParticles.indexOf(childParticle);
        if (index !== -1) {
            this.childParticles.splice(index, 1);
            childParticle.parentParticle = null;
            return true;
        }
        return false;
    }

    getChildParticles() : Particle[] {
        return this.childParticles;
    }

    /**
     * Searches for the hook point of the particle given by the following formula
     * a_a = Vs * Vf
     * alpha_a = (Vs . Vf) * phi * delta_t
     *--------------------------------------
     * a_a :  the axis
     * alpha_a : rotational angle
     * vs : the closest vector pointing tower the surface
     * vf : current forward vector of the particle
     * phi : user defined parameter representing the adaption strength
     * delta_t : the time step of the simulation
     * */
    surfaceAdaptation(octree: any) : void {
        //cross entre vecteur getWorldDirection et 0,1,0
        const crossProduct = new THREE.Vector3()
        let WorldDirection = new THREE.Vector3();
        this.mesh.getWorldDirection(WorldDirection);
        const up = new THREE.Vector3(1, 0, 0)
        crossProduct.crossVectors(WorldDirection, up);
        this.vf = crossProduct;

        this.vs = this.getDirectionToClosestSurface(octree);

        this.a_a = this.vs.clone().cross(this.vf);
        // a_a = new THREE.Vector3().crossVectors(this.vs.clone(),this.vf.clone())
        this.alpha_a = this.vs.dot(this.vf) * this.phi * this.delta_t;
    }

    // launch a ray from the origin with a cone shape to find the closest surface
    // once the point is found, we can compute the vector pointing toward it
    //compute vector
    // TODO Fix Octree's type
    getDirectionToClosestSurface(octree: any) : THREE.Vector3 {
        // get octree closest node
        let meshCenter = this.mesh.position.clone();
        const closestTriangle = octree.getClosestTriangleFromPoint(meshCenter);
        const triangleCenter = new THREE.Vector3(
            (closestTriangle.a.x + closestTriangle.b.x + closestTriangle.c.x) / 3,
            (closestTriangle.a.y + closestTriangle.b.y + closestTriangle.c.y) / 3,
            (closestTriangle.a.z + closestTriangle.b.z + closestTriangle.c.z) / 3
        );
        return triangleCenter.sub(meshCenter).normalize();

    }

    getCenterPoint() : THREE.Vector3 {
        return this.mesh.position;
    }

    findBestOccultationPoint(light: { position: { distanceTo: (arg0: THREE.Vector3) => any; }; }, scene: THREE.Scene){
        if(!isObjectInShadowWithRay(light, this.mesh, scene)){ // if the particle is not in shadow, we don't need to find the best occultation point
            return null;
        }

        let tabPoints = [];
        let centerPoint = this.getCenterPoint();
        let bottomPOint = new THREE.Vector3(centerPoint.x, centerPoint.y - this.dimensions.y/2, centerPoint.z);
        let topPoint = new THREE.Vector3(centerPoint.x, centerPoint.y + this.dimensions.y/2, centerPoint.z);
        tabPoints.push(centerPoint);
        tabPoints.push(bottomPOint);
        tabPoints.push(topPoint);

        let bestPoint = null;
        let minDistance = Infinity;
        for (let point of tabPoints){
            let distance = light.position.distanceTo(point);
            if (distance < minDistance){
                minDistance = distance;
                bestPoint = point;
            }
        }

        return bestPoint;
    }


    photomorphicAdaptation(light: { position: THREE.Vector3Like; }, scene: THREE.Scene, eta: number, delta_t: number){
        // const bestPoint = this.findBestOccultationPoint(light, scene);
        // if (bestPoint){
        //     this.mesh.position.set(bestPoint.x, bestPoint.y, bestPoint.z);
        // }
        //vector to the light

        // console.log("photomorphicAdaptation called");
        // Vérifier les valeurs de vl et vf

        const vl = new THREE.Vector3();
        vl.subVectors(light.position, this.mesh.position).normalize();
        // console.log("vl:", vl, "vf:", this.vf);


        //a_p = vl*vf
        // Vérifier que vf n'est pas nul avant le produit vectoriel
        if (this.vf.lengthSq() > 0) {
            this.a_p = new THREE.Vector3().crossVectors(vl, this.vf);
        } else {
            // console.warn("vf is (0,0,0), setting a_p to default (1,0,0)");
            this.a_p = new THREE.Vector3(1, 0, 0); // Valeur par défaut
        }


        // Calculate the occultation O
       // const O = isObjectInShadowWithRay(light, this.mesh, scene) ? 1 : 0;

        const O = isObjectInShadow(light, this.mesh) ? 1 : 0;

        // α_p = (1 - O) * eta * ∆t
        // console.log("O:", O, "eta:", eta, "delta_t:", delta_t);
        this.alpha_p = (1 - O) * eta * delta_t;
        // console.log("alpha_p:", this.alpha_p);

    }

    /**
     * Integrates growth by updating the particle's orientation based on the accumulated rotation matrix.
     */
    growth() : void {
        // Vérifier si a_a et a_p sont valides (non nuls)
        if (!this.a_a || this.a_a.lengthSq() === 0) {
            // console.warn("a_a is undefined or (0,0,0), setting to default (0,1,0)");
            this.a_a = new THREE.Vector3(0, 0, 0); // Vecteur par défaut vers le haut
        }

        if (!this.a_p || this.a_p.lengthSq() === 0) {
            // console.warn("a_p is undefined or (0,0,0), setting to default (1,0,0)");
            this.a_p = new THREE.Vector3(1, 0, 0); // Vecteur par défaut
        }

        // Vérifier si alpha_a et alpha_p sont valides
        if (typeof this.alpha_a === "undefined" || this.alpha_a === 0) {
            // console.warn("alpha_a is not defined or 0, setting to a small default rotation");
            this.alpha_a = 0.001; // Angle de rotation par défaut
        }

        if (typeof this.alpha_p === "undefined" || this.alpha_p === 0) {
            // console.warn("alpha_p is not defined or 0, setting to a small default rotation");
            this.alpha_p = 0; // Angle de rotation par défaut
        }

        // Calcul des matrices de rotation
        // console.log("a_a:",this.a_a);
        // console.log("alpha_a:",this.a_a);
        let R_aa_alpha_a = new THREE.Matrix4().makeRotationAxis(this.a_a.clone().normalize(), this.alpha_a);
        // console.log("R_aa_alpha_a:",R_aa_alpha_a);
        // console.log("a_p:",this.a_p);
        // console.log("alpha_p:",this.alpha_p);
        let R_ap_alpha_p = new THREE.Matrix4().makeRotationAxis(this.a_p.clone().normalize(), this.alpha_p);
        // console.log("R_ap_alpha_p:",R_ap_alpha_p);

        if (!R_aa_alpha_a.isMatrix4 || !R_ap_alpha_p.isMatrix4) {
            console.error("Invalid rotation matrices");
            return;
        }

        // Calcul de la matrice de rotation accumulée
        this.Rg = new THREE.Matrix4().multiplyMatrices(R_aa_alpha_a, R_ap_alpha_p);

        // Mettre à jour les orientations
        //this.updateOrientations(Rg);
    }

    growthIntegration() : void {
        // Assurer que les matrices sont valides avant de les multiplier
        if (this.R && !this.R.isMatrix4) {
            console.error("Matrice de rotation initiale invalide, elle doit être une instance de THREE.Matrix4");
            return;
        }//TODO THIS
        // console.log("Rotation Matrix (R):", this.R);
        // console.log("Rotation Matrix (Rg):", Rg);

        this.R = new THREE.Matrix4().multiplyMatrices(this.R, Rg);
        // console.log("Rotation Matrix (R):", this.R);


        // Inverser la matrice R pour calculer R_bar
        const R_inversed = new THREE.Matrix4().copy(this.R).invert();
        // console.log("Rotation Matrix (R_inversed):", R_inversed);

        this.R_bar = new THREE.Matrix4().multiplyMatrices(this.R_bar, R_inversed).multiply(Rg); // R_bar = R_bar * R^-1 * Rg
        // console.log("Rotation Bar (R_bar):", this.R_bar);

        // Mise à jour de la position de la particule selon l'équation (10)
        const uf = new THREE.Vector3(0, 1, 0);  // Vecteur unitaire dans la direction Y
        this.mesh.position.add(new THREE.Vector3().applyMatrix4(this.R_bar).applyMatrix4(new THREE.Matrix4().makeTranslation(uf.x, uf.y, uf.z)));


        // // Réinitialisation de la matrice de l'objet
        // this.mesh.matrix.identity();
        //
        // // Appliquer la rotation à la matrice de l'objet
        // this.mesh.applyMatrix4(this.R);
        //
        // // Mise à jour de la matrice du monde
        // this.mesh.updateMatrixWorld();
    }

    updateOrientations(Rg: THREE.Matrix4) : void {
        // Assurer que les matrices sont valides avant de les multiplier
        if (this.R && !this.R.isMatrix4) {
            console.error("Matrice de rotation initiale invalide, elle doit être une instance de THREE.Matrix4");
            return;
        }
        // console.log("Rotation Matrix (R):", this.R);
        // console.log("Rotation Matrix (Rg):", Rg);

        this.R = new THREE.Matrix4().multiplyMatrices(this.R, Rg);
        // console.log("Rotation Matrix (R):", this.R);


        // Inverser la matrice R pour calculer R_bar
        const R_inversed = new THREE.Matrix4().copy(this.R).invert();
        // console.log("Rotation Matrix (R_inversed):", R_inversed);

        this.R_bar = new THREE.Matrix4().multiplyMatrices(this.R_bar, R_inversed).multiply(Rg); // R_bar = R_bar * R^-1 * Rg
        // console.log("Rotation Bar (R_bar):", this.R_bar);

        // Mise à jour de la position de la particule selon l'équation (10)
        const uf = new THREE.Vector3(0, 1, 0);  // Vecteur unitaire dans la direction Y
        this.mesh.position.add(new THREE.Vector3().applyMatrix4(this.R_bar).applyMatrix4(new THREE.Matrix4().makeTranslation(uf.x, uf.y, uf.z)));


        // // Réinitialisation de la matrice de l'objet
        // this.mesh.matrix.identity();
        //
        // // Appliquer la rotation à la matrice de l'objet
        // this.mesh.applyMatrix4(this.R);
        //
        // // Mise à jour de la matrice du monde
        // this.mesh.updateMatrixWorld();
    }

    animateGrowth(light: any, scene: THREE.Scene, eta: number, delta_t: number) : void {
        this.photomorphicAdaptation(light, scene, eta, delta_t);
        this.growth();

        // Appliquer la croissance à chaque enfant récursivement
        this.childParticles.forEach(child => {
            child.animateGrowth(light, scene, eta, delta_t);
        });

        this.update();
    }




    scale(factor: number) : void {
        this.mesh.scale.multiplyScalar(factor);
        this.mesh.updateMatrixWorld(); // Mettre à jour la matrice du monde
    }


    // ======== PBD PHYSICS PART

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
        
        if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
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
        if (this.angular_velocity.length() < EPSILON) {
            this.q_pred = this.q_current.clone();
            return;
        }
        let length = this.angular_velocity.length();
        let angular_velocity_norm_dt_div_2 = length * deltaTime / 2.0;
        let firstTerm = this.angular_velocity.clone().multiplyScalar(Math.sin(angular_velocity_norm_dt_div_2)).multiplyScalar(1.0/length);
        let secondTerm = Math.cos(angular_velocity_norm_dt_div_2);
        this.q_pred = new Quat(
                firstTerm.x,
                firstTerm.y,
                firstTerm.z,
                secondTerm
            ).multiply(this.q_current.clone());
    
    }

    getAdjacentGroup() : Particle[] {
        let adjacentGroups: Particle[] = [];
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
        let adjacentGroup : Particle[] = this.getAdjacentGroup();
        for (let i = 0; i < adjacentGroup.length; i++) {
            this.gc.add(adjacentGroup[i].x_rest.clone().multiplyScalar(adjacentGroup[i].mass));
            this.gc_bar.add(adjacentGroup[i].x_pred.clone().multiplyScalar(adjacentGroup[i].mass));
            mass_sum += adjacentGroup[i].mass;
        } //TODO seems sus
        this.gc.multiplyScalar(1/mass_sum);
        this.gc_bar.multiplyScalar(1/mass_sum);
    }

    updateOptimalRotationMatrix() {
        let adjacentGroup : Particle[] = this.getAdjacentGroup();
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
        let Rtmp = U.clone().multiply(Vt);
        if (Rtmp.determinant() < 0) {
        // on « flip » la dernière colonne de U
        U.elements[2] *= -1;
        U.elements[5] *= -1;
        U.elements[8] *= -1;
        Rtmp = U.multiply(Vt);
        }
        this.Rgroup.copy(Rtmp);
    }

    updateTargetPosition() {
        // We can calculate the target position for each aprticle group as (Eq. 3)
        let xmc = this.x_rest.clone().sub(this.gc_bar);
        this.gx_t = new THREE.Vector3(
            xmc.x * this.Rgroup.elements[0] + xmc.y * this.Rgroup.elements[1] + xmc.z * this.Rgroup.elements[2],
            xmc.x * this.Rgroup.elements[3] + xmc.y * this.Rgroup.elements[4] + xmc.z * this.Rgroup.elements[5],
            xmc.x * this.Rgroup.elements[6] + xmc.y * this.Rgroup.elements[7] + xmc.z * this.Rgroup.elements[8]
        ).add(this.gc);
    }

    updateGoalPosition() {
        this.x_goal = new THREE.Vector3(0, 0, 0);
        let adjacentGroup : Particle[] = this.getAdjacentGroup();
        let W = 0;
        for (let i = 0; i < adjacentGroup.length; i++) {
            let particle = adjacentGroup[i];
            this.x_goal.add(particle.gx_t.multiplyScalar(particle.weight));
            W += particle.weight;
        }
        if (W == 0) {
            W = 1;
        }
        this.x_goal = this.x_goal.multiplyScalar(1/W);
    }

    otherUpdates(delta_time: number) {
        this.velocity = this.x_pred.clone().sub(this.x_rest.clone()).multiplyScalar(1/delta_time); // (Eq. 17)

        const s = 0.8; 
        this.position = this.x_pred.clone()
                .add( this.x_goal.clone().sub(this.x_pred.clone()).multiplyScalar(s) ); // (Eq. 18) + section 4.3
        if (this.position.y < 0) {
            this.position.y = 0;
            this.velocity.y = 0;
        }    
        // angularvel is axis(q_p q^-1) dot angle(q_p q^-1) / delta_time (Eq. 19)
        let qpqi = this.q_pred.clone().multiply(this.q_current.conjugate());
        let axisNorm = new THREE.Vector3(qpqi.x, qpqi.y, qpqi.z).normalize();
        if (axisNorm.length() < EPSILON) {
            // or stability reasons, ω should be set to zero directly if |angle(qpq−1)| < ε. (Eq. 14 , "Solid Simulation with Oriented Particles", M. Muller 2011)
            this.angular_velocity = new THREE.Vector3(0, 0, 0);
        } else {
            let angleNorm = Math.acos(qpqi.w);
            if (angleNorm < 0) {
                angleNorm = -angleNorm;
            }
            this.angular_velocity = axisNorm.clone().multiplyScalar(angleNorm).multiplyScalar(1.0/delta_time);
        }

        this.q_current = this.q_pred.clone(); // (Eq. 20)
    }

    updateDepth() {
        if (this.parent) {
            this.depth = this.parent.depth + 1;
        } else {
            this.depth = 0;
        }
    }

    recursiveWeightUpdate(depth: number = 0) {
        this.depth = depth;
        this.updateWeight();
        for (let i = 0; i < this.childs.length; i++) {
            this.childs[i].recursiveWeightUpdate(depth + 1);
        }
    }

    updateWeight() {
        this.weight = this.f(this.depth) * this.mass;
        this.material.color.setHSL(1-this.f(this.depth), 1, 0.5);
    }

    f(depth: number) : number {
        return Math.pow(0.95, depth);
    }
    // define get and set for this.x
}

function updateParticleGroup(delta_time : number, particleGroup : Particle[], gravity : THREE.Vector3, externalForce : THREE.Vector3,
    light: any, scene: THREE.Scene, octree:any, eta: number, rootIndex : number=0) : void {
    particleGroup[rootIndex].recursiveWeightUpdate();
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.firstStep(delta_time, gravity, externalForce);
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.updateGroupCenterOfMass();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.updateOptimalRotationMatrix();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.updateTargetPosition();
    }
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.updateGoalPosition();
    }
    // Integration scheme after the solver
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.otherUpdates(delta_time);
    }
    // Surface adaptation
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.surfaceAdaptation(octree);
    }
    // Phototropism
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.photomorphicAdaptation(light, scene, eta, delta_time);
    }
    // Growth integration
    for (let i = 0; i < particleGroup.length; i++) {
        let particle = particleGroup[i];
        particle.growth();
    }
}

function particleRope(scene: THREE.Scene, world: CANNON.World, size=10) : Particle[] {
    let particles = [];
    console.log('MIN_WIDTH:', MIN_WIDTH, 'MIN_HEIGHT:', MIN_HEIGHT);
    for (let i = 0; i < size; i++) {

        let particule = new Particle(
            new THREE.Vector3(
                0,
                i * MIN_HEIGHT * 2,
                0),
            new THREE.Euler(
                0,
                0,
                0),
            new THREE.MeshPhongMaterial({
                color: Math.random() * 0xffffff
            }), world, i === 0);
        if (i > 0) {
            particles[i - 1].addChildParticle(particule);
        }
        particule.createEllipsoid();
        //particule.addToScene(scene);
        scene.add(particule.mesh);
        particule.depth = i;
        particles.push(particule);
        if (i === 0) {
            console.log("first particle");
            console.log(particule);
        }
    }
    return particles;
}

function horizontalParticleRope(scene: THREE.Scene, world: CANNON.World, size=10) : Particle[] {
    let particles = [];
    console.log('MIN_WIDTH:', MIN_WIDTH, 'MIN_HEIGHT:', MIN_HEIGHT);
    for (let i = 0; i < size; i++) {

        let particule = new Particle(
            new THREE.Vector3(
                i * MIN_HEIGHT * 2,
                3,
                2),
            new THREE.Euler(
                0,
                0,
                PI/2),
            new THREE.MeshPhongMaterial({
                color: Math.random() * 0xffffff
            }), world, i === 0);
        if (i > 0) {
            particles[i - 1].addChildParticle(particule);
        }
        particule.createEllipsoid();
        //particule.addToScene(scene);
        scene.add(particule.mesh);
        particule.depth = i;
        particles.push(particule);
        if (i === 0) {
            console.log("first particle");
            console.log(particule);
        }
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