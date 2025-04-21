//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {GROUP_PLANT, GROUP_GROUND} from "../utils/Engine";
import {scene} from "../utils/Scene";
import {Vector3} from "three";
import { Octree } from "utils/Octree";
import { World } from "cannon-es";

export const MAX_PARTICLE_CHILDS : number = 4;
export const MAX_CONSTRAINT_ANGLE : number = Math.PI/2;
export const TWIST_ANGLE : number = Math.PI/3;
export const MAX_DISTANCE_CONSTRAINT : number = 9;

export const MIN_WIDTH : number = 0.25;
export const MAX_WIDTH : number = 1.0;
export const MIN_HEIGHT : number = 0.5;
export const MAX_HEIGHT : number = 2.0;



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
    position;
    rotation : THREE.Euler;
    material : THREE.MeshPhongMaterial;
    mesh : THREE.Mesh = new THREE.Mesh();
    dimensions : THREE.Vector3 = new THREE.Vector3(MIN_WIDTH, MIN_HEIGHT, MIN_WIDTH);
    vf : THREE.Vector3 = new THREE.Vector3(); // current forward vector of the particle
    vs : THREE.Vector3 = new THREE.Vector3(); // the closest vector pointing tower the surface
    phi : number = 0.5; // user defined parameter representing the adaption strength
    delta_t : number = 0.0; // the time step of the simulation
    a_a : THREE.Vector3 = new THREE.Vector3(); // the axis
    alpha_a : number = 0.0; // rotational angle


    // Physics engine
    world; // The physics world
    physicsBody; // The physics body of the ellipsoid (Cylinder shape)
    parentParticle : Particle | null = null; // The parent particle of this particle
    childParticles : Particle[] = []; // The child particles of this particle
    constraints : CANNON.Constraint[] = []; // The constraints of this particle

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
        this.position = position;
        this.rotation = rotation;
        this.material = material;

        // Physics engine
        this.world = world;
        this.physicsBody = new CANNON.Body({
            mass: isSeed ? 0 : 1,
            //shape: new CANNON.Cylinder(radius, radius, lengthY*0.9, widthSegments),
            shape: new CANNON.Sphere(this.dimensions.x),
        });
        this.physicsBody.position.set(position.x, position.y, position.z);
        this.physicsBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        this.physicsBody.collisionFilterGroup = GROUP_PLANT;
        this.physicsBody.collisionFilterMask = GROUP_GROUND | GROUP_PLANT;
        this.physicsBody.type = isSeed ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC;
        this.world.addBody(this.physicsBody);

        this.createEllipsoid();
        this.update();
    }

    updateDimensionsBasedOnAge() : void {
        const width = THREE.MathUtils.lerp(MIN_WIDTH, MAX_WIDTH, Math.log(this.age + 1) / Math.log(10));
        const height = THREE.MathUtils.lerp(MIN_HEIGHT, MAX_HEIGHT, Math.log(this.age + 1) / Math.log(10));
        this.dimensions = new THREE.Vector3(width, height, width);
    }

    createEllipsoid() {
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
    update() {
        // Copy the position and quaternion of the physics body to the mesh at each update
        this.mesh.position.copy(this.physicsBody.position);
        this.mesh.quaternion.copy(this.physicsBody.quaternion);
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
            let constraint = new CANNON.ConeTwistConstraint(
                this.physicsBody,
                childParticle.physicsBody,
                {
                    pivotA: this.getChildAttachPoint(),
                    pivotB: childParticle.getParentAttachPoint(),
                    axisA: new CANNON.Vec3(0, 1, 0),
                    axisB: new CANNON.Vec3(0, 1, 0),
                    angle: MAX_CONSTRAINT_ANGLE,
                    twistAngle: TWIST_ANGLE,
                    collideConnected: false
                }
            )
            let distanceConstraint = new CANNON.DistanceConstraint(
                this.physicsBody,
                childParticle.physicsBody,
                this.dimensions.y,
                MAX_DISTANCE_CONSTRAINT
            );
            this.world.addConstraint(constraint);
            this.world.addConstraint(distanceConstraint);
            this.constraints.push(constraint);
            this.constraints.push(distanceConstraint);
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
            for (const constraint of this.constraints) {
                this.world.removeConstraint(constraint);
            }
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
    searchForAttachPoint(octree: any) : void {
        //cross entre vecteur getWorldDirection et 0,1,0
        const crossProduct = new THREE.Vector3()
        let WorldDirection = new THREE.Vector3();
        this.mesh.getWorldDirection(WorldDirection);
        const up = new THREE.Vector3(1, 0, 0)
        crossProduct.crossVectors(WorldDirection, up);
        this.vf = crossProduct;

        this.vs = this.getDirectionToClosestSurface(octree);

        this.a_a = this.vs.clone().cross(this.vf);
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
}

export default Particle;

export function particleRope(scene: { add: (arg0: any) => void; }, world: World, size=50) : Particle[] {
    let particles = [];
    for (let i = 0; i < size; i++) {
        const particule = new Particle(
            new THREE.Vector3(
                Math.random() * MIN_WIDTH - MIN_WIDTH / 2,
                i * MIN_HEIGHT,
                Math.random() * MIN_WIDTH - MIN_WIDTH / 2),
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
        particles.push(particule);
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