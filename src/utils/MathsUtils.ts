import * as THREE from 'three';
import { SVD } from "svd-js";

export const PI : number = Math.PI;
export const EPSILON : number = 0.0001;

function mat3Add(a: THREE.Matrix3, b: THREE.Matrix3): THREE.Matrix3 {
    return new THREE.Matrix3().set(
        // THREE.Matrix3 is stored in column-major order
        // But Matrix3.set takes values in row-major order
        // https://threejs.org/docs/?q=matrix#api/en/math/Matrix3
        a.elements[0] + b.elements[0], a.elements[3] + b.elements[3], a.elements[6] + b.elements[6],
        a.elements[1] + b.elements[1], a.elements[4] + b.elements[4], a.elements[7] + b.elements[7],
        a.elements[2] + b.elements[2], a.elements[5] + b.elements[5], a.elements[8] + b.elements[8]
    )
}

function mat3FromQuaternion(q: THREE.Quaternion): THREE.Matrix3 {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    return new THREE.Matrix3().set(
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)
    );
}

function matrix3To2DArray(matrix: THREE.Matrix3): number[][] {
    const elements = matrix.elements; 
    return [
        // THREE.Matrix3 is stored in column-major order
        [elements[0], elements[3], elements[6]], // Column 1
        [elements[1], elements[4], elements[7]], // Column 2
        [elements[2], elements[5], elements[8]], // Column 3
    ];
}

function getRot(axis: THREE.Vector3, angle: number): THREE.Matrix3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;

    return new THREE.Matrix3().set(
        t * axis.x * axis.x + c, t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
        t * axis.y * axis.x + s * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z - s * axis.x,
        t * axis.z * axis.x - s * axis.y, t * axis.z * axis.y + s * axis.x, t * axis.z * axis.z + c
    );
}

function polarDecomposition(A: THREE.Matrix3) : THREE.Matrix3 {
    const {u, q, v} = SVD(matrix3To2DArray(A));
    const U = new THREE.Matrix3().set(
        u[0][0], u[0][1], u[0][2],
        u[1][0], u[1][1], u[1][2],
        u[2][0], u[2][1], u[2][2]
    );
    const Vt = new THREE.Matrix3().set(
        v[0][0], v[1][0], v[2][0],
        v[0][1], v[1][1], v[2][1],
        v[0][2], v[1][2], v[2][2]
    );
    return U.multiply(Vt);
}

// Helper function to clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculates the normal of a triangle
 * @param a First vertex of the triangle
 * @param b Second vertex of the triangle
 * @param c Third vertex of the triangle
 * @returns The normalized normal vector of the triangle
 */
function calculateTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    const edge1 = b.clone().sub(a);
    const edge2 = c.clone().sub(a);
    return edge1.cross(edge2).normalize();
}

/**
 * Lerp between two vectors with a smooth step
 * @param a First vector
 * @param b Second vector
 * @param t Interpolation factor (0-1)
 * @returns Interpolated vector
 */
function smoothLerp(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
    // Apply smooth step function to t
    const s = t * t * (3 - 2 * t);
    return a.clone().lerp(b, s);
}

/**
 * Generates a random vector perpendicular to the given direction
 * @param direction The reference direction
 * @returns A normalized random vector perpendicular to the direction
 */
function randomPerpendicular(direction: THREE.Vector3): THREE.Vector3 {
    // Create a randomized vector
    const randomVec = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
    ).normalize();
    
    // Get a vector perpendicular to the direction
    const perpendicular = direction.clone().cross(randomVec);
    
    // If perpendicular is too small, try again with a different random vector
    if (perpendicular.lengthSq() < EPSILON) {
        return randomPerpendicular(direction);
    }
    
    return perpendicular.normalize();
}

/**
 * Finds the closest point on a triangle to a given point
 * @param point The point to find the closest point to
 * @param a First vertex of the triangle
 * @param b Second vertex of the triangle
 * @param c Third vertex of the triangle
 * @returns The closest point on the triangle
 */
function closestPointOnTriangle(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    // Check if point is in vertex region outside a
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const ap = point.clone().sub(a);
    
    const d1 = ab.dot(ap);
    const d2 = ac.dot(ap);
    
    // Barycentric coordinates (1, 0, 0)
    if (d1 <= 0 && d2 <= 0) {
        return a.clone();
    }
    
    // Check if point is in vertex region outside b
    const bp = point.clone().sub(b);
    const d3 = ab.dot(bp);
    const d4 = ac.dot(bp);
    
    // Barycentric coordinates (0, 1, 0)
    if (d3 >= 0 && d4 <= d3) {
        return b.clone();
    }
    
    // Check if point is in edge region of AB, if so return projection of point onto AB
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3);
        return a.clone().add(ab.multiplyScalar(v));
    }
    
    // Check if point is in vertex region outside c
    const cp = point.clone().sub(c);
    const d5 = ab.dot(cp);
    const d6 = ac.dot(cp);
    
    // Barycentric coordinates (0, 0, 1)
    if (d6 >= 0 && d5 <= d6) {
        return c.clone();
    }
    
    // Check if point is in edge region of AC, if so return projection of point onto AC
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        return a.clone().add(ac.multiplyScalar(w));
    }
    
    // Check if point is in edge region of BC, if so return projection of point onto BC
    const va = d3 * d6 - d5 * d4;
    const bc = c.clone().sub(b);
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return b.clone().add(bc.multiplyScalar(w));
    }
    
    // Point is inside the face region. Compute the closest point using barycentric coordinates
    const denom = 1.0 / (va + vb + vc);
    const v = vb * denom;
    const w = vc * denom;
    
    // The closest point is: a + v*ab + w*ac
    const closest = a.clone().add(ab.multiplyScalar(v)).add(ac.multiplyScalar(w));
    return closest;
}

/**
 * Projects a vector onto a plane defined by its normal
 * @param vector The vector to project
 * @param normal The normal of the plane
 * @returns The projected vector (tangent to the plane)
 */
function projectVectorOntoPlane(vector: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
    // Formula: v_projected = v - (v·n)n
    const dotProduct = vector.dot(normal);
    return vector.clone().sub(normal.clone().multiplyScalar(dotProduct));
}

export { mat3Add, mat3FromQuaternion, getRot, polarDecomposition, matrix3To2DArray, clamp, calculateTriangleNormal, smoothLerp, randomPerpendicular, closestPointOnTriangle, projectVectorOntoPlane };