//Particule.js

//a particule is represented by an ellipsoid 3D shape
import * as THREE from "three";
import { Octree } from "utils/Octree";
import { isObjectInShadow, isObjectInShadowWithRay } from "../utils/ObjectInShadow.js";
import { coordonneToObject } from "../utils/coordonneToObject";
import { VineTubeRenderer } from "../rendering/VineTubeRenderer";
import { VineLeafRenderer } from "../rendering/VineLeafRenderer";
import * as MathsUtils from "../utils/MathsUtils";

// Create a map to store plant IDs
const plantIdMap = new Map();

export const SMALLEST_PARTICLE_FACTOR : number = 0.1;
export const MAX_WIDTH : number = 0.5;
export const MAX_HEIGHT : number = 1.0;

export const WIDTH_GROWTH_RATE : number = 0.5; // 0.2
export const HEIGHT_GROWTH_RATE : number = 1.8; // 0.6

export const DEFAULT_DIMENSIONS : THREE.Vector3 = new THREE.Vector3(
    SMALLEST_PARTICLE_FACTOR * MAX_WIDTH,
    SMALLEST_PARTICLE_FACTOR * MAX_WIDTH,
    SMALLEST_PARTICLE_FACTOR * MAX_HEIGHT,
);

export const DELTA_WIDTH : number = WIDTH_GROWTH_RATE * MAX_WIDTH;
export const DELTA_HEIGHT : number = HEIGHT_GROWTH_RATE * MAX_HEIGHT;

export const VEC_UP : THREE.Vector3 = new THREE.Vector3(0, 1, 0);

export const MAX_ROTATION_PER_FRAME : number = Math.PI / 12;

// Strength values for orientation behaviors
export const SURFACE_ADAPTATION_STRENGTH : number = 8;
export const PHOTOTROPISM_RESPONSE_STRENGTH : number = 2;

// Anti-penetration settings
export const PENETRATION_CORRECTION_STRENGTH : number = 12; // Higher value = stronger correction when penetrating
export const PENETRATION_CHECK_DISTANCE : number = 0.1; // How far ahead to check for penetration

// Growth variance settings
export const GROWTH_VARIANCE_MAX : number = 0.3; // Maximum angle deviation (as a fraction of PI)
export const DIRECTION_SMOOTHING : number = 0.9; // How much to smooth direction changes (0-1)
export const NORMAL_SMOOTHING_RADIUS : number = 2.0; // Radius to collect and average normals

// Branching settings
export const BRANCH_SELECTION_FACTOR : number = 0.15; // Probability increase factor when selecting a particle
export const MIN_BRANCH_ANGLE : number = Math.PI / 3; // 60 degrees off the main stem
export const MAX_BRANCH_ANGLE : number = Math.PI * 2 / 3; // 120 degrees off the main stem
export const BRANCH_GROWTH_FACTOR : number = 0.75; // Size factor for branches compared to main stem

export const WIREFRAME : boolean = true;

export const STIFFNESS : number = 0.2;

export const ParticleParameters = {
    allowLateralBranching: false,
    lateralBranchProbability: 0.04,
    lateralBranchCooldown: 1500,
    growthRate: 1.0,
    plantRendering: true,
}

class Particle {
    widthLOD : number = 8;
    heightLOD : number = 4;
    scene : THREE.Scene; // Scene of the ellipsoid
    mesh : THREE.Mesh; // Mesh of the ellipsoid
    material : THREE.MeshStandardMaterial; // Material of the ellipsoid
    pointAtXRest : THREE.Points; // Point at rest position

    x: THREE.Vector3; // Position
    x_prev: THREE.Vector3 | null; // Previous Position
    x_rest: THREE.Vector3; // Rest Position
    x_pred: THREE.Vector3; // Predicted Position
    x_target: THREE.Vector3; // Target Position
    x_goal: THREE.Vector3; // Goal Position

    v: THREE.Vector3; // Linear Velocity

    q: THREE.Quaternion; // Rotation
    q_prev: THREE.Quaternion | null; // Previous Rotation
    q_rest: THREE.Quaternion; // Rest Rotation
    q_pred: THREE.Quaternion; // Predicted Rotation
    R: THREE.Matrix3; // Rotation Matrix
    R_rest: THREE.Matrix3; // Rest Rotation Matrix

    w: THREE.Vector3; // Angular Velocity

    x_anchor: THREE.Vector3; // Anchor position
    surfaceNormal: THREE.Vector3 | null = null; // Normal of the surface at the anchor point
    smoothedNormal: THREE.Vector3 | null = null; // Smoothed normal averaged from nearby triangles

    c: THREE.Vector3; // Center of mass of the group
    c_rest: THREE.Vector3; // Rest Center of mass of the group

    dimensions : THREE.Vector3; // Ellipsoid dimensions

    A: THREE.Matrix3 = new THREE.Matrix3(); // Moment matrix

    Rg: THREE.Matrix3 = new THREE.Matrix3(); // Least square optimal matrix

    rho: number = 0.5; // Density of the ellipsoid

    mass: number = 1.0; // Mass of the ellipsoid
    weight: number = 1.0; // Weight of the ellipsoid, f(depth)

    childs: Particle[] = []; // Child ellipsoids
    parent: Particle | null = null; // Parent ellipsoid
    depth: number; // Depth of the ellipsoid in the hierarchy

    hasApicalChild: boolean = false; // True if the ellipsoid has an apical child
    isSeed: boolean = false; // True if the ellipsoid is the seed of the plant
    isLateralBranch: boolean = false; // True if this particle is part of a lateral branch
    branchCount: number = 0; // Number of branches grown from this particle
    lastBranchTime: number = 0; // Time when the last branch was grown

    // Track if we're currently correcting for penetration
    isPenetrating: boolean = false;
    
    // Growth variance
    biasAxis: THREE.Vector3 | null = null; // Axis for random growth direction 
    biasAngle: number = 0; // Angle for random growth direction
    preferredDir: THREE.Vector3 | null = null; // Smoothed direction that combines previous directions
    
    // Normal smoothing
    lastValidSurfaceNormal: THREE.Vector3 | null = null;

    /**
     *
     * @param {THREE.Vector3} position Position of the ellipsoid's center
     * @param {THREE.Euler} rotation Rotation of the ellipsoid
     * @param {THREE.MeshPhongMaterial} material Phong material of the ellipsoid (contains the color !)
     * @param {THREE.Mesh} mesh ??
     * @param {THREE.Scene} world Physics engine world
     * @param {boolean} isSeed true if this particle is the seed of the plant, false otherwise
     */
    constructor(position: THREE.Vector3, rotation: THREE.Quaternion, material: THREE.MeshStandardMaterial, scene: THREE.Scene, depth=0, isSeed=false, isLateralBranch=false) {
        this.x = position.clone();
        this.x_prev = null;
        this.x_rest = position.clone();
        this.x_pred = position.clone();
        this.x_target = position.clone();
        this.x_goal = position.clone();

        this.q = rotation.clone();
        this.q_prev = null;
        this.q_rest = this.q.clone();
        this.q_pred = this.q.clone();

        this.R = MathsUtils.mat3FromQuaternion(this.q).clone();
        this.R_rest = this.R.clone();

        this.v = new THREE.Vector3(0, 0, 0);
        this.w = new THREE.Vector3(0, 0, 0);

        this.c = position.clone();
        this.c_rest = position.clone();

        this.dimensions = DEFAULT_DIMENSIONS.clone();

        this.scene = scene;
        this.material = material;
        this.material.wireframe = WIREFRAME;
        this.mesh = new THREE.Mesh();
        this.createMesh();
        this.mesh.visible = true;
        this.scene.add(this.mesh);

        this.depth = depth;
        this.isSeed = isSeed;
        this.isLateralBranch = isLateralBranch;

        this.pointAtXRest = coordonneToObject({x:this.x_rest.x, y:this.x_rest.y, z:this.x_rest.z});

        this.pointAtXRest.material = this.material;
        this.pointAtXRest.scale.set(5, 5, 5);
        this.scene.add(this.pointAtXRest);

        this.x_anchor = this.x.clone();
        
        // Initialize growth bias with consistent random direction
        if (!isSeed) {
            this.initializeGrowthBias();
        }
    }
    
    /**
     * Initialize a stable random growth bias
     */
    initializeGrowthBias(): void {
        // Get the initial growth direction (from parent or default up)
        const initialDir = this.parent ? this.parent.getDir() : new THREE.Vector3(0, 1, 0);
        
        // Create a random axis perpendicular to the growth direction
        this.biasAxis = MathsUtils.randomPerpendicular(initialDir);
        
        // Random angle for consistent deviation
        // Using triangular distribution for more natural variation
        const r1 = Math.random();
        const r2 = Math.random();
        const triangular = (r1 + r2) / 2; // Values cluster around 0.5
        
        // Map to [-GROWTH_VARIANCE_MAX, GROWTH_VARIANCE_MAX] * PI
        this.biasAngle = (triangular * 2 - 1) * GROWTH_VARIANCE_MAX * Math.PI;
        
        // Initialize the preferred direction with the current direction
        this.preferredDir = this.getDir().clone();
    }

    /**
     * Apply the consistent growth bias to a direction
     * @param direction The direction to apply bias to
     * @returns A new direction with bias applied
     */
    applyGrowthBias(direction: THREE.Vector3): THREE.Vector3 {
        if (!this.biasAxis || this.isSeed) return direction.clone();
        
        // Create a rotation quaternion representing our bias
        const rotation = new THREE.Quaternion().setFromAxisAngle(this.biasAxis, this.biasAngle);
        
        // Apply the rotation to the direction
        return direction.clone().applyQuaternion(rotation).normalize();
    }

    /**
     * Check if the particle is fully grown
     * @returns true if the particle is fully grown
     */
    isFullyGrown(): boolean {
        return this.dimensions.x >= MAX_WIDTH && 
               this.dimensions.y >= MAX_WIDTH && 
               this.dimensions.z >= MAX_HEIGHT;
    }

    stillGrowing() : boolean {
        // Check if the particle is still growing
        return !this.isFullyGrown();
    }

    selfGrowth(dt: number, octree: Octree) {
        if (!this.stillGrowing()) return;
        if (this.dimensions.x < MAX_WIDTH) {
            this.dimensions.x += DELTA_WIDTH * dt * ParticleParameters.growthRate;
            this.dimensions.y += DELTA_WIDTH * dt * ParticleParameters.growthRate;
        }
        if (this.dimensions.z < MAX_HEIGHT) {
            this.dimensions.z += DELTA_HEIGHT * dt * ParticleParameters.growthRate;
        }
        
        // Clamp dimensions to max values
        this.dimensions.x = Math.min(this.dimensions.x, MAX_WIDTH);
        this.dimensions.y = Math.min(this.dimensions.y, MAX_WIDTH);
        this.dimensions.z = Math.min(this.dimensions.z, MAX_HEIGHT);
        
        this.updateMass();
        this.updateMomentMatrix();
        this.updateAnchor(octree);
    }

    updateAnchor(octree: Octree) {
        const closestTriangle = octree.getClosestTriangleFromPoint(this.x);
        
        // Calculate the normal of the closest triangle
        const triangleNormal = MathsUtils.calculateTriangleNormal(
            closestTriangle.a,
            closestTriangle.b,
            closestTriangle.c
        );
        
        // Store this normal
        this.surfaceNormal = triangleNormal;
        
        // If we have a previous valid normal, smooth the transition
        if (this.lastValidSurfaceNormal) {
            // Only smooth if they're not too different (to avoid smoothing drastically different areas)
            const dotProduct = this.lastValidSurfaceNormal.dot(triangleNormal);
            if (dotProduct > 0.7) { // Less than ~45 degrees difference
                this.smoothedNormal = MathsUtils.smoothLerp(
                    this.lastValidSurfaceNormal,
                    triangleNormal,
                    0.3 // Smooth factor - higher = more responsive to changes
                ).normalize();
            } else {
                this.smoothedNormal = triangleNormal;
            }
        } else {
            this.smoothedNormal = triangleNormal;
        }
        
        // Save this normal for next time
        this.lastValidSurfaceNormal = triangleNormal;
        
        // Get closest point on triangle
        this.x_anchor = MathsUtils.closestPointOnTriangle(
            this.x,
            closestTriangle.a,
            closestTriangle.b,
            closestTriangle.c
        );
    }

    rotate(angle: number, axis: THREE.Vector3) {
        // Update the particle's quaternion
        const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        this.q.premultiply(rotation);
        this.q.normalize(); // Ensure quaternion stays normalized
    }
    
    updateMass() {
        this.mass = this.rho * 4*Math.PI/3 * this.dimensions.x * this.dimensions.y * this.dimensions.z;
    }

    updateMomentMatrix() {
        const mass_5 = this.mass / 5;
        this.A = new THREE.Matrix3().set(
            mass_5 * (this.dimensions.y*this.dimensions.y + this.dimensions.z*this.dimensions.z), 0, 0,
            0, mass_5 * (this.dimensions.x*this.dimensions.x + this.dimensions.z*this.dimensions.z), 0,
            0, 0, mass_5 * (this.dimensions.x*this.dimensions.x + this.dimensions.y*this.dimensions.y)
        );
    }

    updateWeight() {
        this.weight = this.f(this.depth) * this.mass;
        this.material.color.setHSL(1-this.f(this.depth), 1, 0.5);
    }

    f(depth: number) : number {
        return Math.pow(0.95, depth);
    }

    closestAnchor(position: THREE.Vector3, octree: Octree) : THREE.Vector3 {
        const closestTriangle = octree.getClosestTriangleFromPoint(position);
        
        // Instead of using the center of the triangle, find the actual closest point on the triangle
        return MathsUtils.closestPointOnTriangle(
            position,
            closestTriangle.a,
            closestTriangle.b,
            closestTriangle.c
        );
    }
    
    createMesh() {
        const geometry = new THREE.SphereGeometry(
            this.dimensions.x,
            this.widthLOD,
            this.heightLOD
        )
        this.mesh = new THREE.Mesh(
            geometry,
            this.material
        );
        geometry.translate(0 , this.dimensions.y/2, 0);
        this.mesh.position.set(this.x.x, this.x.y, this.x.z);
        this.mesh.quaternion.copy(this.q);
        this.mesh.scale.set(this.dimensions.x, this.dimensions.y, this.dimensions.z);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.mesh.visible = true;
        this.mesh.updateMatrixWorld();
    }

    getDir() : THREE.Vector3 {
        return new THREE.Vector3(0, 1, 0).applyQuaternion(this.q).normalize();
    }

    getSide() : THREE.Vector3 {
        return new THREE.Vector3(1, 0, 0).applyQuaternion(this.q).normalize();
    }

    getHead() : THREE.Vector3 {
        return this.x.clone().add(this.getDir().multiplyScalar(this.dimensions.y));
    }

    // Check if the growth direction will lead to entering into the mesh
    checkPenetration(octree: Octree): boolean {
        if (this.isSeed) return false;
        
        // Get the current growth direction
        const growthDir = this.getDir();
        
        // Look ahead to see where the tip/head will be
        const lookAheadPoint = this.getHead().add(growthDir.clone().multiplyScalar(PENETRATION_CHECK_DISTANCE));
        
        // Find the closest point on the surface to the look-ahead point
        const closestTriangle = octree.getClosestTriangleFromPoint(lookAheadPoint);
        const closestPoint = MathsUtils.closestPointOnTriangle(
            lookAheadPoint,
            closestTriangle.a,
            closestTriangle.b, 
            closestTriangle.c
        );
        
        // Calculate the surface normal at this point
        const surfaceNormal = MathsUtils.calculateTriangleNormal(
            closestTriangle.a,
            closestTriangle.b,
            closestTriangle.c
        );
        
        // Vector from look-ahead point to closest surface point
        const toSurface = closestPoint.clone().sub(lookAheadPoint);
        
        // Check if we're pointing into the surface by comparing with normal
        // If the dot product of growth direction and surface normal is negative,
        // we're trying to grow into the surface
        const dotWithNormal = growthDir.dot(surfaceNormal);
        
        // We're penetrating if:
        // 1. Look-ahead point is close to surface (toSurface length is small)
        // 2. AND we're pointing into the surface
        const distanceToSurface = toSurface.length();
        const isPenetrating = distanceToSurface < this.dimensions.y * 0.5 && dotWithNormal < 0;
        
        this.isPenetrating = isPenetrating;
        return isPenetrating;
    }

    // Apply a corrective rotation to avoid penetrating the surface
    correctPenetration(octree: Octree, dt: number) {
        if (this.isSeed || !this.isPenetrating || !this.smoothedNormal) return;
        
        // Get the current growth direction
        const growthDir = this.getDir();
        
        // Use the smoothed normal to avoid abrupt changes
        const normal = this.smoothedNormal;
        
        // We want to rotate toward the surface normal
        const rotationAxis = growthDir.clone().cross(normal).normalize();
        
        // If rotation axis is too small (vectors are nearly parallel)
        if (rotationAxis.lengthSq() < MathsUtils.EPSILON) {
            // Try a different approach - rotate around any axis perpendicular to growth
            const worldUp = new THREE.Vector3(0, 1, 0);
            rotationAxis.copy(worldUp.cross(growthDir));
            
            // If still too small, try another axis
            if (rotationAxis.lengthSq() < MathsUtils.EPSILON) {
                rotationAxis.set(1, 0, 0).cross(growthDir);
            }
            
            rotationAxis.normalize();
        }
        
        // Calculate correction angle - stronger when more deeply penetrating
        // The strength is determined by how much we're pointing into the surface
        const penetrationAngle = Math.acos(MathsUtils.clamp(growthDir.dot(normal), -1, 1));
        const correctionStrength = PENETRATION_CORRECTION_STRENGTH * dt;
        const correctionAngle = MathsUtils.clamp(penetrationAngle * correctionStrength, 0, MAX_ROTATION_PER_FRAME);
        
        // Apply correction rotation - rotate away from surface
        const correctionRotation = new THREE.Quaternion().setFromAxisAngle(rotationAxis, correctionAngle);
        this.q.premultiply(correctionRotation);
        this.q.normalize();
        
        // When we correct for penetration, we need to recalculate our preferred direction
        if (this.preferredDir) {
            const newDir = this.getDir();
            this.preferredDir = MathsUtils.smoothLerp(this.preferredDir, newDir, 0.5).normalize();
        }
    }

    /**
     * Create a lateral branch on this particle
     * @param particles Array of all particles
     * @returns Boolean indicating if branch was successfully created
     */
    growLateralBranch(particles: Particle[]): boolean {
        // Don't grow branches from seeds or from particles that aren't fully grown
        if (this.isSeed || !this.isFullyGrown()) {
            return false;
        }
        
        // Check if enough time has passed since last branch
        const currentTime = performance.now();
        if (currentTime - this.lastBranchTime < ParticleParameters.lateralBranchCooldown) {
            return false;
        }
        
        // Generate a random angle for the branch
        const branchAngle = MIN_BRANCH_ANGLE + Math.random() * (MAX_BRANCH_ANGLE - MIN_BRANCH_ANGLE);
        
        // Randomly choose position around the stem
        const rotationAngle = Math.random() * 2 * Math.PI;
        
        // Get the main stem direction
        const mainDir = this.getDir();
        
        // Create a rotation axis perpendicular to growth direction
        const rotationAxis = MathsUtils.randomPerpendicular(mainDir);
        
        // Rotate around the main stem
        const aroundStemRotation = new THREE.Quaternion().setFromAxisAngle(mainDir, rotationAngle);
        rotationAxis.applyQuaternion(aroundStemRotation);
        
        // Create quaternion for the branch direction
        const branchRotation = new THREE.Quaternion().setFromAxisAngle(rotationAxis, branchAngle);
        const branchQuaternion = this.q.clone().premultiply(branchRotation);
        
        // Set branch position at the side of the parent particle
        const sideOffset = new THREE.Vector3(0, 0, 0)
            .applyQuaternion(branchQuaternion)
            .normalize()
            .multiplyScalar(this.dimensions.x * 0.8);
        
        const branchPosition = this.x.clone().add(sideOffset);
        
        // Create different color for branch
        const branchMaterial = this.material.clone();
        branchMaterial.color.set(this.isLateralBranch ? this.material.color : this.material.color.clone().multiplyScalar(0.75));
        
        // Create the branch particle
        const branch = new Particle(
            branchPosition,
            branchQuaternion,
            branchMaterial,
            this.scene,
            this.depth + 1,
            false,
            true // This is a lateral branch
        );
        
        // Scale down branch dimensions
        branch.dimensions.multiplyScalar(BRANCH_GROWTH_FACTOR);
        
        // Set up parent-child relationship
        branch.parent = this;
        this.childs.push(branch);
        particles.push(branch);
        
        // Update counters
        this.branchCount++;
        this.lastBranchTime = currentTime;
        
        // Ensure proper initialization
        this.updateParticleGroupsCentersOfMass();
        branch.updateParticleGroupsCentersOfMass();
        
        return true;
    }

    growApicalChild(particles: Particle[]) : void {
        if (this.hasApicalChild) return;
        if (this.dimensions.z < MAX_HEIGHT) return;
        
        let child = new Particle(
            this.x.clone().add(this.getDir().multiplyScalar(this.dimensions.y/2)),
            this.q.clone(),
            this.material.clone(),
            this.scene,
            this.depth + 1,
            false,
            this.isLateralBranch // Inherit lateral branch status
        );
        
        child.x_rest.copy(this.x_rest).add(this.getDir().clone().multiplyScalar(this.dimensions.y/2));
        child.parent = this;
        this.childs.push(child);
        particles.push(child);
        this.hasApicalChild = true;

        this.updateParticleGroupsCentersOfMass();
        child.updateParticleGroupsCentersOfMass();
    }

    updateMesh(): void {
        this.mesh.position.copy(this.x);
        const direction = this.getDir();
        const targetPosition = this.x.clone().add(direction); // A point in the direction of `getDir`
        this.mesh.lookAt(targetPosition);
        this.mesh.updateMatrixWorld();
        this.mesh.scale.set(this.dimensions.x, this.dimensions.y, this.dimensions.z);
    }

    eulerIntegration(dt: number, gravity: THREE.Vector3, externalForces: THREE.Vector3) : void {
        this.x_goal = new THREE.Vector3(0, 0, 0);
        if (this.isSeed) {
            this.x_pred = this.x.clone();
            this.q_pred = this.q.clone();
            return;
        }
        this.x_pred = this.x.clone()
        .add(this.v.clone().addScalar(dt))
        .add(gravity.clone().add(externalForces).multiplyScalar(dt*dt/2));

        const ang_vel_length = this.w.length();
        if (ang_vel_length < MathsUtils.EPSILON) {
            this.q_pred = this.q.clone();
            return;
        }
        const axis = this.w.clone().normalize()
            .multiplyScalar(Math.sin(ang_vel_length * dt / 2));
        const angle = Math.cos(ang_vel_length * dt / 2);
        this.q_pred = new THREE.Quaternion(
            axis.x,
            axis.y,
            axis.z,
            angle
        ).multiply(this.q);
    }

    getGroup() : Particle[] {
        let particles : Particle[] = [this];
        if (this.parent) {
            particles.push(this.parent);
        }
        for (let i = 0; i < this.childs.length; i++) {
            particles.push(this.childs[i]);
        }
        return particles;
    }

    updateParticleGroupsCentersOfMass() {
        let mass_sum = 0;
        this.c.set(0, 0, 0);
        this.c_rest.set(0, 0, 0);

        let group = this.getGroup();
        let i = 0;
        for (i = 0; i < group.length; i++) {
            this.c.add(group[i].x_pred.clone().multiplyScalar(group[i].mass));
            this.c_rest.add(group[i].x_rest.clone().multiplyScalar(group[i].mass));
            mass_sum += group[i].mass;
        }
        this.c.multiplyScalar(1/mass_sum);
        this.c_rest.multiplyScalar(1/mass_sum);
    }

    updateLeastSquareOptimalMatrix() {
        let A : THREE.Matrix3 = new THREE.Matrix3()
        .set(
            0, 0, 0,
            0, 0, 0,
            0, 0, 0
        );

        let group = this.getGroup();
        let c = group[0].c.clone();
        let c_rest = group[0].c_rest.clone();
        let M = 0;
        for (let i = 0; i < group.length; i++) {
            let particle = group[i];
            let X = new THREE.Matrix3()
            .set(
                particle.x.x * particle.x_rest.x, particle.x.x * particle.x_rest.y, particle.x.x * particle.x_rest.z,
                particle.x.y * particle.x_rest.x, particle.x.y * particle.x_rest.y, particle.x.y * particle.x_rest.z,
                particle.x.z * particle.x_rest.x, particle.x.z * particle.x_rest.y, particle.x.z * particle.x_rest.z
            )
            .multiplyScalar(particle.mass);
            M += particle.mass;
            A = MathsUtils.mat3Add(A, X);
        }
        let C = new THREE.Matrix3()
        .set(
            c.x * c_rest.x, c.x * c_rest.y, c.x * c_rest.z,
            c.y * c_rest.x, c.y * c_rest.y, c.y * c_rest.z,
            c.z * c_rest.x, c.z * c_rest.y, c.z * c_rest.z
        )
        .multiplyScalar(M); // should be -M ? but it crashes
        A = MathsUtils.mat3Add(A, C);

        this.Rg = MathsUtils.polarDecomposition(A);
    }

    updateTargetPosition() {
        this.x_target = this.x_rest.clone().sub(this.c_rest).applyMatrix3(this.Rg).add(this.c);
    }

    updateGoalPosition() {
        this.x_goal = new THREE.Vector3(0, 0, 0);

        let weightsum = 0;
        let group = this.getGroup();

        for (let i = 0; i < group.length; i++) {
            let particle = group[i];
            this.x_goal.add(particle.x_target.multiplyScalar(particle.weight));
            weightsum += particle.weight;
        }

        this.x_goal.multiplyScalar(1/weightsum);
    }

    applyStiffness() {
        this.x_goal = this.x_pred.clone().add(this.x_goal.clone().sub(this.x_pred).multiplyScalar(STIFFNESS));
    }

    integrationScheme(dt: number) {
        if(this.isSeed) return;

        // n terms of orientation, we only update the orientation of the center particle by replacing it with the optimal rotation provided by shapematching.
        // "Solid Simulation with Oriented Particles" 5.1
        this.q_pred = new THREE.Quaternion(0, 0, 0, 1).setFromRotationMatrix(
            new THREE.Matrix4().set(
                this.Rg.elements[0], this.Rg.elements[3], this.Rg.elements[6], 0,
                this.Rg.elements[1], this.Rg.elements[4], this.Rg.elements[7], 0,
                this.Rg.elements[2], this.Rg.elements[5], this.Rg.elements[8], 0,
                0, 0, 0, 1
            )
        );

        // Linear velocity
        this.v = this.x_goal.clone().sub(this.x).multiplyScalar(dt);

        // Position
        this.x = this.x_goal.clone();
        

        // Angular velocity
        let r = this.q_pred.clone().multiply(this.q.invert());
        if (r.w < 0) {
            r = this.q.clone().multiply(this.q_pred.invert());
        }
        const angle = Math.acos(r.w);
        if (angle < MathsUtils.EPSILON) {
            this.w = new THREE.Vector3(0, 0, 0);
        } else {
            const axis = new THREE.Vector3(r.x, r.y, r.z).normalize();
            this.w = axis.multiplyScalar(angle / dt);
        }

        // Rotation
        this.q = this.q_pred.clone();
    }

    applyDoubleRot(q: THREE.Quaternion, axis1: THREE.Vector3, angle1: number, axis2: THREE.Vector3, angle2: number) : THREE.Euler {
        // Clamp rotation angles to avoid excessive rotation
        angle1 = MathsUtils.clamp(angle1, -MAX_ROTATION_PER_FRAME, MAX_ROTATION_PER_FRAME);
        angle2 = MathsUtils.clamp(angle2, -MAX_ROTATION_PER_FRAME, MAX_ROTATION_PER_FRAME);
        
        const q1 = new THREE.Quaternion().setFromAxisAngle(axis1, angle1);
        const q2 = new THREE.Quaternion().setFromAxisAngle(axis2, angle2);
        
        // Apply rotations in sequence
        let quaternion = q.clone().multiply(q1).multiply(q2);
        quaternion.normalize(); // Ensure the quaternion is normalized
        
        return new THREE.Euler().setFromQuaternion(quaternion);
    }

    getVs() : THREE.Vector3 {
        if (this.isSeed) {
            return new THREE.Vector3(0, 1, 0);  // Always use up vector for seed
        }
        
        // Get vector from current position to anchor point on the surface
        const surfaceVector = this.x_anchor.clone().sub(this.x);
        
        // If the vector is too small, try to use smoothed normal and parent direction
        if (surfaceVector.lengthSq() < 0.01) {
            // If we have a parent and smoothed normal, use them to determine a better direction
            if (this.parent && this.smoothedNormal) {
                // Project parent's direction onto the surface plane
                const parentDir = this.parent.getDir();
                const tangentDir = MathsUtils.projectVectorOntoPlane(parentDir, this.smoothedNormal);
                
                if (tangentDir.lengthSq() > MathsUtils.EPSILON) {
                    return tangentDir.normalize();
                }
            }
            
            return new THREE.Vector3(0, 1, 0);
        }
        
        return surfaceVector.normalize();
    }

    /**
     * Update the preferred growth direction
     * This maintains consistency in growth direction
     */
    updatePreferredDirection(dt: number): void {
        if (this.isSeed || !this.preferredDir) return;
        
        // Get current direction
        const currentDir = this.getDir();
        
        // Apply our stable growth bias
        const biasedDir = this.applyGrowthBias(currentDir);
        
        // Smoothly blend with the existing preferred direction
        this.preferredDir = MathsUtils.smoothLerp(
            this.preferredDir,
            biasedDir,
            dt * (1 - DIRECTION_SMOOTHING) // Smaller values = more smoothing
        ).normalize();
    }

    plantOrientation(dt: number, light: any, octree: Octree) {
        if (this.hasApicalChild || this.isSeed) return;
        
        // First, check if we're about to penetrate the surface
        this.checkPenetration(octree);
        
        // If we're penetrating, apply a corrective rotation first
        if (this.isPenetrating) {
            this.correctPenetration(octree, dt);
            // After correction, still continue with other orientations
            // but with reduced strength to allow correction to be effective
            dt *= 0.5;
        }
        
        // Update our stable preferred direction
        this.updatePreferredDirection(dt);
        
        // Get current direction
        const v_f = this.getDir().normalize();
        
        // Get direction to surface (normalized vector from particle to closest anchor)
        const v_s = this.getVs();
        
        // If we have a preferred direction, blend it with the surface vector
        let targetDir = v_s;
        if (this.preferredDir) {
            // Project the preferred direction onto the surface plane if we have a normal
            if (this.smoothedNormal) {
                const tangentPreferred = MathsUtils.projectVectorOntoPlane(this.preferredDir, this.smoothedNormal);
                if (tangentPreferred.lengthSq() > MathsUtils.EPSILON) {
                    // Blend between surface vector and preferred direction
                    targetDir = v_s.clone().lerp(tangentPreferred.normalize(), 0.5).normalize();
                }
            } else {
                // If no normal available, just blend directly
                targetDir = v_s.clone().lerp(this.preferredDir, 0.5).normalize();
            }
        }
        
        // Calculate surface adaptation
        // Cross product gives axis of rotation
        const a_a = v_f.clone().cross(targetDir).normalize();
        
        // If vectors are nearly parallel, rotation axis might be undefined
        if (a_a.lengthSq() < MathsUtils.EPSILON) {
            // Skip surface adaptation for this frame
        } else {
            // Calculate rotation angle for surface adaptation
            // 1 - dot product gives a value between 0 and 2, where:
            // - 0 means vectors are parallel (no rotation needed)
            // - 2 means vectors are opposite (max rotation needed)
            const alignmentFactor = 1 - v_f.clone().dot(targetDir);
            
            // Apply a smoothed rotation to prevent sudden changes
            // Stronger adaptation for more misalignment
            const alpha_a = MathsUtils.clamp(alignmentFactor * SURFACE_ADAPTATION_STRENGTH * dt, -MAX_ROTATION_PER_FRAME, MAX_ROTATION_PER_FRAME);
            
            // Apply rotation toward surface-preferred direction
            if (Math.abs(alpha_a) > MathsUtils.EPSILON) {
                const rotation = new THREE.Quaternion().setFromAxisAngle(a_a, alpha_a);
                this.q.premultiply(rotation);
                this.q.normalize();
            }
        }
        
        // Phototropism calculation (attraction to light)
        // Vector from particle to light source
        const d_l = light.position.clone().sub(this.x);
        
        // Distance to light affects strength of phototropism
        const distanceToLight = d_l.length();
        // Define a minimum distance to prevent extreme rotation when very close to light
        const minDistance = 1.0;
        // Inverse square falloff with a minimum distance cap
        const occlusion = 5 / Math.max(distanceToLight * distanceToLight, minDistance);
        
        d_l.normalize();
        
        // Calculate phototropism rotation axis and angle
        const a_p = v_f.clone().cross(d_l).normalize();
        
        // Skip if rotation axis is undefined (vectors are parallel)
        if (a_p.lengthSq() > MathsUtils.EPSILON) {
            // Dot product determines how much rotation is needed
            // A positive dot product means we're already facing toward the light
            const dotProduct = v_f.clone().dot(d_l);
            
            // Scale the rotation angle based on alignment and distance
            const alpha_p = MathsUtils.clamp(dotProduct * PHOTOTROPISM_RESPONSE_STRENGTH * dt * occlusion, -MAX_ROTATION_PER_FRAME, MAX_ROTATION_PER_FRAME);
            
            // Apply rotation toward light
            if (Math.abs(alpha_p) > MathsUtils.EPSILON) {
                const rotation = new THREE.Quaternion().setFromAxisAngle(a_p, alpha_p);
                this.q.premultiply(rotation);
                this.q.normalize();
            }
        }
        
        // After applying all rotations, check again to ensure we didn't introduce a penetration
        if (this.checkPenetration(octree)) {
            this.correctPenetration(octree, dt);
        }
    }
}

function tryGrowBranch(particleGroup: Particle[], dt: number): boolean {
    // Check if we should attempt to grow a branch this frame
    if (Math.random() > ParticleParameters.lateralBranchProbability * dt) {
        return false;
    }
    
    const numParticles = particleGroup.length;
    if (numParticles === 0) return false;
    
    // Find the maximum weight to normalize probabilities
    let maxWeight = 0;
    for (let i = 0; i < numParticles; i++) {
        if (particleGroup[i].weight > maxWeight) {
            maxWeight = particleGroup[i].weight;
        }
    }
    
    if (maxWeight <= 0) return false;
    
    // Pick a random starting point in the list
    const startIndex = Math.floor(Math.random() * numParticles);
    
    // Check each particle once, starting from the random position
    for (let offset = 0; offset < numParticles; offset++) {
        // Calculate the actual index with wrap-around
        const index = (startIndex + offset) % numParticles;
        const particle = particleGroup[index];
        
        // Skip ineligible particles
        if (!particle.isFullyGrown() || 
            particle.isSeed || 
            performance.now() - particle.lastBranchTime < ParticleParameters.lateralBranchCooldown) {
            continue;
        }
        
        // Calculate probability based on weight and branch count
        const normalizedWeight = particle.weight / maxWeight;
        const branchFactor = Math.pow(0.7, particle.branchCount);
        const probability = normalizedWeight * branchFactor * BRANCH_SELECTION_FACTOR;
        
        // Check if this particle gets a branch
        if (Math.random() < probability) {
            // Found a particle - grow branch and exit loop
            return particle.growLateralBranch(particleGroup);
        }
    }
    
    return false;
}

function applyToAllParticles(particleGroup: Particle[], func: (particle: Particle) => void) {
    for (let i = 0; i < particleGroup.length; i++) {
        func(particleGroup[i]);
    }
}

function updateParticleGroup(delta_time: number, particleGroup: Particle[], gravity: THREE.Vector3, externalForce: THREE.Vector3,
    light: any, scene: THREE.Scene, octree: any, eta: number, rootIndex: number = 0): void {
    
    // Get or create the tube renderer (shared across all plants)
    if (!scene.userData.vineTubeRenderer) {
        scene.userData.vineTubeRenderer = new VineTubeRenderer(scene);
    }
    const tubeRenderer = scene.userData.vineTubeRenderer;
    
    // Get or create the leaf renderer (shared across all plants)
    if (!scene.userData.vineLeafRenderer) {
        scene.userData.vineLeafRenderer = new VineLeafRenderer(scene);
    }
    const leafRenderer = scene.userData.vineLeafRenderer;
    
    // Get or create a unique ID for this plant group
    let plantId;
    const rootParticle = particleGroup.find(p => p.isSeed);
    
    if (rootParticle) {
        // Use the root particle's position as a unique identifier
        const rootPosKey = `${rootParticle.x.x.toFixed(2)}_${rootParticle.x.y.toFixed(2)}_${rootParticle.x.z.toFixed(2)}`;
        
        if (!plantIdMap.has(rootPosKey)) {
            plantIdMap.set(rootPosKey, `plant_${plantIdMap.size}`);
        }
        
        plantId = plantIdMap.get(rootPosKey);
    } else {
        // Fallback if no seed found
        plantId = `plant_${rootIndex}`;
    }
    
    let testing = false;
    // Testing
    if (testing) {
        return;
    }
    
    // Self growth & anchor update
    applyToAllParticles(particleGroup, (particle) => {
        particle.selfGrowth(delta_time, octree);
    });

    // Surface adaptation & Phototropism
    applyToAllParticles(particleGroup, (particle) => {
        particle.plantOrientation(delta_time, light, octree);
    });
    
    // Try to grow a branch for the entire group
    if (ParticleParameters.allowLateralBranching) tryGrowBranch(particleGroup, delta_time);

    // Grow apical children
    applyToAllParticles(particleGroup, (particle) => {
        particle.growApicalChild(particleGroup);
    });

    // Mesh updates
    applyToAllParticles(particleGroup, (particle) => {
        particle.updateMesh();
    });
    
    // Update tube rendering for the vine core with the unique plant ID
    tubeRenderer.updateTubes(particleGroup, plantId);
    
    // Update leaf rendering with the unique plant ID
    leafRenderer.updateLeaves(particleGroup, plantId);
}

export { Particle, updateParticleGroup };