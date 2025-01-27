//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";

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


    constructor(radius, widthSegments, heightSegments, color, position, rotation, material, mesh) {
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
        this.color = color;
        this.position = position;
        this.rotation = rotation;
        this.material = material;
        this.mesh = mesh;
       // this.wireFrame = new THREE.EdgesGeometry(this.mesh.geometry);
        //this.wireFrame= new THREE.LineSegments(new THREE.LineBasicMaterial({color: 0x000000, linewidth: 2}), this.wireFrame);
        //this.mesh.add(this.wireFrame);
        this.createEllipsoid();
    }

    createEllipsoid(){
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, this.widthSegments, this.heightSegments), this.material);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
        this.mesh.scale.set(2, 1, 1);
       }

    update(){
        this.mesh.rotation.x += 0.1;
        this.mesh.rotation.y += 0.1;
        this.mesh.rotation.z += 0.1;

    }

}

export default Particule;



