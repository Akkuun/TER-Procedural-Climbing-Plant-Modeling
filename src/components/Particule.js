//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {GROUP_PLANT, GROUP_GROUND} from "../utils/Engine";
import {scene} from "../utils/Scene";
import {Vector3} from "three";
import {vec3} from "three/tsl";

export const MAX_PARTICLE_CHILDS = 4;

class Particule {
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

    radius;
    widthSegments;
    heightSegments;
    position;
    rotation;
    material;
    mesh;
    wireFrame;
    lengthY;
    vf; // forward vector of the particle
    vs; // closest vector pointing toward the surface
    phi; // user defined parameter representing the adaption strength
    delta_t; // the time step of the simulation
    a_a; // the axis
    alpha_a; // rotational angle


    // Physics engine
    world; // The physics world
    physicsBody; // The physics body of the ellipsoid (Cylinder shape)
    parentParticle; // The parent particle of this particle
    childParticles = []; // The child particles of this particle

    /**
     *
     * @param {*} radius ??
     * @param {*} widthSegments ??
     * @param {*} heightSegments ??
     * @param {THREE.Vector3} position Position of the ellipsoid's center
     * @param {THREE.Euler} rotation Rotation of the ellipsoid
     * @param {THREE.MeshPhongMaterial} material Phong material of the ellipsoid (contains the color !)
     * @param {*} mesh ??
     * @param {CANNON.World} world Physics engine world
     * @param {float} lengthY Length of the ellipsoid along the y-axis
     */
    constructor(radius, widthSegments, heightSegments, position, rotation, material, mesh, world, lengthY) {
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
        this.position = position;
        this.rotation = rotation;
        this.material = material;
        this.mesh = mesh;
        this.lengthY = lengthY;

        this.vf = new THREE.Vector3();
        this.vs = new THREE.Vector3();
        // Physics engine
        this.world = world;
        this.physicsBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Cylinder(radius, radius, lengthY * 0.9, widthSegments),
        });
        this.physicsBody.position.set(position.x, position.y, position.z);
        this.physicsBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        this.physicsBody.collisionFilterGroup = GROUP_PLANT;
        this.physicsBody.collisionFilterMask = GROUP_GROUND;
        this.world.addBody(this.physicsBody);


        // this.wireFrame = new THREE.EdgesGeometry(this.mesh.geometry);
        //this.wireFrame= new THREE.LineSegments(new THREE.LineBasicMaterial({color: 0x000000, linewidth: 2}), this.wireFrame);
        //this.mesh.add(this.wireFrame);
        this.createEllipsoid();
        this.update();
    }

    createEllipsoid() {
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, this.widthSegments, this.heightSegments), this.material);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
        // Cylinder heights follows the y-axis on the physics body so we need to match this here
        this.mesh.scale.set(1, this.lengthY, 1);
        //activate wireframe
        //this.mesh.material.wireframe = true;
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
    getParentAttachPoint() {
        return new CANNON.Vec3(0, -this.lengthY * 0.45, 0);
    }

    /**
     *
     * @returns the attach point of the child particle (the top of the ellipsoid)
     */
    getChildAttachPoint() {
        return new CANNON.Vec3(0, this.lengthY * 0.45, 0);
    }

    setParentParticle(parentParticle) {
        parentParticle.addChildParticle(this);
    }

    getParentParticle() {
        return this.parentParticle;
    }

    /**
     * Adds a child particle to the particle.
     * @param {Particule} childParticle
     * @returns true if the child particle was added successfully, false otherwise
     */
    addChildParticle(childParticle) {
        if (this.childParticles.length < MAX_PARTICLE_CHILDS - 1) {
            this.childParticles.push(childParticle);
            childParticle.setParentParticle(this);
            let constraint = new CANNON.PointToPointConstraint(
                this.physicsBody,
                this.getChildAttachPoint(),
                childParticle.physicsBody,
                childParticle.getParentAttachPoint()
            );
            this.world.addConstraint(constraint);
            return true;
        }
        return false;
    }

    getChildParticles() {
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
    searchForAttachPoint(cube) {
        //cross entre vecteur getWorldDirection et 0,1,0
        const crossProduct = new THREE.Vector3()
        let WorldDirection = new THREE.Vector3();
        this.mesh.getWorldDirection(WorldDirection);
        const up = new THREE.Vector3(1, 0, 0)
        crossProduct.crossVectors(WorldDirection, up);
        this.vf = crossProduct;


        this.vs = this.getDirectionToClosestSurface(cube);


        this.a_a = this.vs.clone().cross(this.vf);
        this.alpha_a = this.vs.dot(this.vf) * this.phi * this.delta_t;
    }

    // launch a ray from the origin with a cone shape to find the closest surface
    // once the point is found, we can compute the vector pointing toward it
    //compute vector
    getDirectionToClosestSurface(cube) {
        let origin = this.getCenterPoint();
        const direction = new THREE.Vector3();
        const directions = this.generateDirections(270, 50); // 180° avec 36 directions
        let closestIntersection = null;
        let minDistance = Infinity;

        const raycaster = new THREE.Raycaster();

        for (const direction of directions) {
            raycaster.set(origin, direction);
            const intersects = raycaster.intersectObject(cube);

            if (intersects.length > 0 && intersects[0].distance < minDistance) {
                minDistance = intersects[0].distance;
                closestIntersection = intersects[0];
            }
        }

        if (closestIntersection) {
            return closestIntersection.point.sub(origin).normalize();
        } else {
            return null;
        }


    }

    getCenterPoint() {
        return this.mesh.position;
    }

    //function that generates directions for the raycaster to search for the closest surface from the search cone of 180°
    generateDirections(angle, steps) {
        const directions = [];
        const stepAngle = angle / steps;

        for (let i = 0; i < steps; i++) {
            const theta = THREE.MathUtils.degToRad(i * stepAngle);
            const direction = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0).normalize();
            directions.push(direction);
        }

        return directions;
    }
}

export default Particule;



