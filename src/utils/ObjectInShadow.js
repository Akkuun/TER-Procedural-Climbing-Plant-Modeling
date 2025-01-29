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

export function isObjectInShadowWithRay(light, object, scene) {
    const direction = new THREE.Vector3();
    const lightPosition = light.position.clone();
    const objectPosition = object.position.clone();

    //calcule direction
    direction.subVectors(objectPosition, lightPosition).normalize();

    const raycaster = new THREE.Raycaster(lightPosition, direction);

    const intersects = raycaster.intersectObjects(scene.children, true);

    //si le tableau d'intersections n'est pas vide et que l'objet intersecté n'est pas l'objet lui-même, alors l'objet est dans l'ombre
    return intersects.length > 0 && intersects[0].object.uuid !== object.uuid;
}