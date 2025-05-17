import * as THREE from "three";
import { Particle } from "../components/Particle"; // Assuming Particle is defined in this path

export class VineTubeRenderer {
    constructor(scene) {
        this.scene = scene;
        this.tubeMeshes = new Map(); // Maps particle IDs to tube meshes
        this.tubeMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5e1c0, // Beige
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide,
            flatShading: false,
        });
        
        this.radiusScaleFactor = 0.1;
    }

    /**
     * Update or create tubes for a particle group
     * @param {Particle[]} particleGroup - Array of all particles
     * @param {string} plantId - Unique identifier for the plant
     */
    updateTubes(particleGroup, plantId) {
        // Get root particle to identify this plant system
        const rootParticle = this.findRootParticle(particleGroup);
        if (!rootParticle) return;
        
        // Use the root particle position as part of the plant ID if not provided
        const plantIdentifier = plantId || `plant_${rootParticle.x.toArray().join('_')}`;
        
        // Clean up any old tube meshes that aren't needed for this plant
        this.cleanupUnusedTubes(particleGroup, plantIdentifier);
        
        // Process each particle that has a parent (to create a tube between them)
        for (const particle of particleGroup) {
            if (particle.parent) {
                this.createOrUpdateTube(particle, particle.parent, plantIdentifier);
            }
            
            // If particle has multiple children, create tubes between them as well
            if (particle.childs.length > 1) {
                this.createConnectingTubes(particle, plantIdentifier);
            }
        }
    }
    
    /**
     * Find the root particle (seed) of a particle group
     */
    findRootParticle(particleGroup) {
        for (const particle of particleGroup) {
            if (particle.isSeed) {
                return particle;
            }
        }
        
        // If no seed found, use the first particle
        return particleGroup.length > 0 ? particleGroup[0] : null;
    }
    
    /**
     * Create or update a tube between a particle and its parent
     */
    createOrUpdateTube(childParticle, parentParticle, plantId) {
        // Create a unique ID for this tube that includes the plant ID
        const tubeId = `${plantId}_${parentParticle.depth}_${parentParticle.x.toArray().join('_')}_${childParticle.depth}_${childParticle.x.toArray().join('_')}`;
        
        // Get positions for the curve
        const points = this.getConnectionPoints(childParticle, parentParticle);
        
        // Create a smooth curve between the points
        const curve = new THREE.CatmullRomCurve3(points);
        
        // Determine tube radius based on particle dimensions (with smaller scale factor)
        const radius = Math.min(childParticle.dimensions.x, parentParticle.dimensions.x) * this.radiusScaleFactor;
        
        // If we already have a tube for this connection, just update it
        if (this.tubeMeshes.has(tubeId)) {
            const tubeMesh = this.tubeMeshes.get(tubeId);
            tubeMesh.geometry.dispose();
            tubeMesh.geometry = new THREE.TubeGeometry(curve, 8, radius, 8, false);
            return;
        }
        
        // Create a new tube
        const tubeGeometry = new THREE.TubeGeometry(curve, 8, radius, 8, false);
        const tubeMesh = new THREE.Mesh(tubeGeometry, this.tubeMaterial);
        tubeMesh.castShadow = true;
        tubeMesh.receiveShadow = true;
        
        // Add to scene and store reference
        this.scene.add(tubeMesh);
        this.tubeMeshes.set(tubeId, tubeMesh);
    }
    
    /**
     * Create tubes connecting a particle's children to visually connect branches
     */
    createConnectingTubes(particle, plantId) {
        if (particle.childs.length <= 1) return;
        
        // Sort children by distance to make logical connections
        const sortedChildren = [...particle.childs].sort((a, b) => {
            // Sort by lateral branch status first, then by distance
            if (a.isLateralBranch !== b.isLateralBranch) {
                return a.isLateralBranch ? 1 : -1;
            }
            return a.x.distanceTo(particle.x) - b.x.distanceTo(particle.x);
        });
        
        // Connect sequential children
        for (let i = 0; i < sortedChildren.length - 1; i++) {
            // Only connect children that are close to each other
            if (sortedChildren[i].x.distanceTo(sortedChildren[i+1].x) < 
                sortedChildren[i].dimensions.x * 4) {
                    
                // Create a unique ID for this connection that includes both children
                const connectionId = `${plantId}_connection_${i}_${particle.depth}`;
                this.createOrUpdateTube(sortedChildren[i], sortedChildren[i+1], connectionId);
            }
        }
    }
    
    /**
     * Get points for a smooth curve between particles
     */
    getConnectionPoints(childParticle, parentParticle) {
        const parentPos = parentParticle.x.clone();
        const childPos = childParticle.x.clone();
        
        const parentDir = parentParticle.getDir();
        const childDir = childParticle.getDir();
        
        // Create control points to make a smoother curve
        const parentControlPoint = parentPos.clone().add(
            parentDir.clone().multiplyScalar(parentParticle.dimensions.y * 0.5)
        );
        
        const childControlPoint = childPos.clone().sub(
            childDir.clone().multiplyScalar(childParticle.dimensions.y * 0.5)
        );
        
        // Return points for the curve
        return [parentPos, parentControlPoint, childControlPoint, childPos];
    }
    
    cleanupUnusedTubes(currentParticles, plantId) {
        const currentIds = new Set();
        
        // Collect all valid tube IDs for this plant
        for (const particle of currentParticles) {
            if (particle.parent) {
                const tubeId = `${plantId}_${particle.parent.depth}_${particle.parent.x.toArray().join('_')}_${particle.depth}_${particle.x.toArray().join('_')}`;
                currentIds.add(tubeId);
            }
        }
        
        // Remove any tubes for this plant not in the current ID set
        const tubeIdsToCheck = [...this.tubeMeshes.keys()].filter(id => id.startsWith(plantId));
        
        for (const tubeId of tubeIdsToCheck) {
            if (!currentIds.has(tubeId)) {
                const tubeMesh = this.tubeMeshes.get(tubeId);
                this.scene.remove(tubeMesh);
                tubeMesh.geometry.dispose();
                this.tubeMeshes.delete(tubeId);
            }
        }
    }

    toggleParticleMeshes(particleGroup, visible) {
        for (const particle of particleGroup) {
            if (particle.mesh) {
                particle.mesh.visible = visible;
            }
        }
    }
    
    dispose() {
        for (const tubeMesh of this.tubeMeshes.values()) {
            this.scene.remove(tubeMesh);
            tubeMesh.geometry.dispose();
        }
        this.tubeMeshes.clear();
    }
    
    setRadiusScaleFactor(factor) {
        this.radiusScaleFactor = factor;
    }
}