//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";
import * as CANNON from "cannon-es";

class Particule  {
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
    color;
    position;
    rotation;
    material;
    mesh;
    wireFrame;
    
    // Physics engine
    world; // The physics world
    physicsBody; // The physics body of the ellipsoid (Cylinder shape)


    constructor(radius, widthSegments, heightSegments, color, position, rotation, material, mesh, world) {
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
        this.color = color;
        this.position = position;
        this.rotation = rotation;
        this.material = material;
        this.mesh = mesh;

        // Physics engine
        this.world = world;
        this.physicsBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Cylinder(radius, radius, 1.8, widthSegments),
        });
        this.physicsBody.position.set(position.x, position.y, position.z);
        this.physicsBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        this.world.addBody(this.physicsBody);

        

       // this.wireFrame = new THREE.EdgesGeometry(this.mesh.geometry);
        //this.wireFrame= new THREE.LineSegments(new THREE.LineBasicMaterial({color: 0x000000, linewidth: 2}), this.wireFrame);
        //this.mesh.add(this.wireFrame);
        this.createEllipsoid();
        this.update();
    }

    createEllipsoid(){
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, this.widthSegments, this.heightSegments), this.material);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
        // Cylinder heights follows the y-axis on the physics body so we need to match this here
        this.mesh.scale.set(1, 2, 1);
       }

    /**
     * Updates the position and quaternion of the mesh based on the physics body
     */
    update(){
        // Copy the position and quaternion of the physics body to the mesh at each update
        this.mesh.position.copy(this.physicsBody.position);
        this.mesh.quaternion.copy(this.physicsBody.quaternion);
    }

    /**
     * Adds the ellipsoid's mesh to the scene
     * @param {THREE.Scene} scene 
     */
    addToScene(scene){
        scene.add(this.mesh);
    }

}

export default Particule;



