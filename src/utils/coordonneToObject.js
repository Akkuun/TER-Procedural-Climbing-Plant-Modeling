import * as THREE from 'three';

export function coordonneToObject(coordonne) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(coordonne), 3)); //magie noir, car l'autre bidule est deprecated
    const mat = new THREE.PointsMaterial({ size: 0.1, color: 0xff0000 });
    return new THREE.Points(geo, mat);
}
