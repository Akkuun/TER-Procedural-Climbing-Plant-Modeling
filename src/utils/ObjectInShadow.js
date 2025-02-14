import * as THREE from 'three';

// Fonction pour vérifier si un objet est dans l'ombre d'une lumière
// son concept est :
// - on récupère la position de l'objet
// - on met à jour la matrice du monde de la lumière et de sa caméra
// - on copie la position de l'objet et on applique la matrice inverse de la caméra de la lumière, ce qui nous permet d'obtenir la position de l'objet dans l'espace de la caméra de la lumière
// - on crée un frustum à partir de la matrice de projection de la caméra de la lumière et de la matrice inverse de la caméra de la lumière, ce qui nous permet de définir la zone de la caméra
// - on vérifie si le point de l'ombre est contenu dans le frustum
// - si le point n'est pas contenu dans le frustum, alors l'objet est dans l'ombre
// Merci : https://stackoverflow.com/questions/24877880/three-js-check-if-object-is-in-frustum
export function isObjectInShadow(light, object) {
    const shadow = new THREE.Vector3();

    // Met à jour les matrices du monde pour la lumière et SA caméra
    light.updateMatrixWorld();
    light.shadow.camera.updateMatrixWorld();

    // Copie la position de l'objet et applique la matrice inverse (MVP != PVM) de la caméra de la lumière
    // Cela permet d'obtenir la position de l'objet dans l'espace de la caméra de la lumière
    shadow.copy(object.position).applyMatrix4(light.shadow.camera.matrixWorldInverse);

    // Crée un frustum : "zone de vision de la caméra"
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(
        light.shadow.camera.projectionMatrix,
        light.shadow.camera.matrixWorldInverse
    ));

    // Vérifie si le point de l'ombre est contenu dans le frustum
    // Si le point de l'ombre n'est pas contenu dans le frustum, alors l'objet est dans l'ombre
    return !frustum.containsPoint(shadow);
}

let previousLine = null;
let listintersect = [];
let debug = false;

export function isObjectInShadowWithRay(light, object, scene) {
    const direction = new THREE.Vector3();
    const lightPosition = light.position.clone();
    const objectPosition = object.position.clone();

    //calcule direction
    direction.subVectors(objectPosition, lightPosition).normalize();

    const raycaster = new THREE.Raycaster(lightPosition, direction);

    if (debug && previousLine) {
        scene.remove(previousLine);
    }



    if(debug){
        //afficher les rayon projetés
        const geometry = new THREE.BufferGeometry().setFromPoints([lightPosition, objectPosition]);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(geometry, material);
        line.name = "BLANCK";
        scene.add(line);
        previousLine = line;
    }


    const intersects = raycaster.intersectObjects(scene.children, true);

    if(debug && listintersect){
        for(let i = 0; i < listintersect.length; i++){
            scene.remove(listintersect[i]);
        }
    }




    //si le tableau d'intersections est vide, alors l'objet n'est pas a l'ombre
    if(intersects.length < 1){
        if(debug){
            console.log("no intersection");
        }
        // Si l'objet intersecté est nommé "ground" et que la lumière est en dessous, alors l'objet est dans l'ombre
        if (lightPosition.y < scene.getObjectByName("ground").position.y) {
            if (debug) {
                console.log("light is below ground, object is in shadow");
                console.log("light position", lightPosition);
                console.log("ground position", scene.getObjectByName("ground") .object.position);
                console.log("if : ", lightPosition.y < scene.getObjectByName("ground") .object.position.y);
            }
            return true;
        }else{
            return false;
        }
    }

    //si on intersect un autre objet que l'objet lui même ou la lumière alors l'objet est dans l'ombre
    for(let i = 0; i < intersects.length; i++){

        //si l'objet intersecter est name "BLANCK" alors on ne le prend pas en compte
        if(intersects[i].object.name === "BLANCK"){
            continue;
        }

        //si le premier objet toucher est le notre alors l'objet n'est pas dans l'ombre
        if(intersects[i].object.uuid === object.uuid){
            if(debug){
                console.log("no intersection");
            }
            return false;
        }else{

            if(debug){
                //mettre une sphère sur l'objet qui intersecte
                const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                sphere.position.copy(intersects[i].point);
                sphere.name = "BLANCK";
                listintersect.push(sphere);
                scene.add(sphere);

                console.log(intersects[i].object);
                console.log("intersection");
            }
            return true;
        }

    }

    if(debug){
        console.log("end ez");
    }
    return true;

}