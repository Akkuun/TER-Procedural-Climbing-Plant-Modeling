import * as THREE from "three";
import { Particle } from "../components/Particle"; // Assuming Particle is defined in this path

export class VineTubeRenderer {
    constructor(scene) {
        this.scene = scene;
        this.tubeData = new Map(); // Maps connection IDs to tube data
        this.maxInstances = 10000;
        this.instanceCount = 0;
        this.radiusScaleFactor = 0.1;
        
        // Create instanced material
        this.tubeMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5e1c0, // Beige
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide,
        });
        
        // Create base geometry for a standardized tube segment
        this.tubeBaseGeometry = this.createBaseTubeGeometry();
        
        // Create instanced mesh
        this.instancedTubes = new THREE.InstancedMesh(
            this.tubeBaseGeometry,
            this.tubeMaterial,
            this.maxInstances
        );
        
        this.instancedTubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedTubes.castShadow = true;
        this.instancedTubes.receiveShadow = true;
        this.instancedTubes.frustumCulled = false;
        
        // Add to scene
        this.scene.add(this.instancedTubes);
        
        // Initialize instance mapping
        this.tubeInstanceMap = new Map(); // Maps tube IDs to instance indices
        this.freeIndices = []; // Reusable indices from removed instances
        
        // Dummy object for transform calculations
        this.dummyObject = new THREE.Object3D();
    }
    
    /**
     * Create a standardized tube segment that can be transformed
     * to fit various curves
     */
    createBaseTubeGeometry() {
        // Create a basic cylinder that will be bent and transformed
        // 8 radial segments, default is straight along Y axis
        return new THREE.CylinderGeometry(1, 1, 1, 8, 8);
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
        
        // Clean up any old tubes that aren't needed for this plant
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
        
        // Update instanced mesh count
        this.instancedTubes.count = this.instanceCount;
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
        
        // Calculate tube parameters
        const startPoint = parentParticle.x.clone();
        const endPoint = childParticle.x.clone();
        const length = startPoint.distanceTo(endPoint);
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        
        // Direction from start to end
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        
        // Determine tube radius based on particle dimensions
        const radius = Math.min(childParticle.dimensions.x, parentParticle.dimensions.x) * this.radiusScaleFactor;
        
        // Check if we need to create or update
        if (!this.tubeInstanceMap.has(tubeId)) {
            // Get next available instance index
            let instanceIndex;
            if (this.freeIndices.length > 0) {
                instanceIndex = this.freeIndices.pop();
            } else {
                instanceIndex = this.instanceCount++;
                if (instanceIndex >= this.maxInstances) {
                    console.warn('Maximum tube instance count reached');
                    return;
                }
            }
            
            // Store tube data and index
            this.tubeData.set(tubeId, {
                startPoint: startPoint.clone(),
                endPoint: endPoint.clone(),
                radius: radius
            });
            
            this.tubeInstanceMap.set(tubeId, instanceIndex);
            
            // Position and transform the tube instance
            this.positionTubeInstance(instanceIndex, startPoint, endPoint, midPoint, direction, length, radius);
        } else {
            // Get existing instance index
            const instanceIndex = this.tubeInstanceMap.get(tubeId);
            const existingData = this.tubeData.get(tubeId);
            
            // Check if anything changed
            if (!existingData.startPoint.equals(startPoint) || 
                !existingData.endPoint.equals(endPoint) ||
                existingData.radius !== radius) {
                
                // Update stored data
                existingData.startPoint.copy(startPoint);
                existingData.endPoint.copy(endPoint);
                existingData.radius = radius;
                
                // Update position and transform
                this.positionTubeInstance(instanceIndex, startPoint, endPoint, midPoint, direction, length, radius);
            }
        }
    }
    
    /**
     * Position and transform a tube instance to connect two points
     */
    positionTubeInstance(instanceIndex, startPoint, endPoint, midPoint, direction, length, radius) {
        // Reset the dummy object
        this.dummyObject.position.set(0, 0, 0);
        this.dummyObject.rotation.set(0, 0, 0);
        this.dummyObject.scale.set(1, 1, 1);
        
        // Set position to midpoint
        this.dummyObject.position.copy(midPoint);
        
        // Scale to match length and radius
        this.dummyObject.scale.set(radius, length, radius);
        
        // Rotate to align with direction vector
        // Default cylinder is along Y axis
        this.dummyObject.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), // Y-axis
            direction
        );
        
        // Apply curve bending if needed for more advanced effects
        // (This would require shader-based approach for true curved tubes)
        
        // Update the instance matrix
        this.dummyObject.updateMatrix();
        this.instancedTubes.setMatrixAt(instanceIndex, this.dummyObject.matrix);
        this.instancedTubes.instanceMatrix.needsUpdate = true;
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
    
    cleanupUnusedTubes(currentParticles, plantId) {
        const currentIds = new Set();
        
        // Collect all valid tube IDs for this plant
        for (const particle of currentParticles) {
            if (particle.parent) {
                const tubeId = `${plantId}_${particle.parent.depth}_${particle.parent.x.toArray().join('_')}_${particle.depth}_${particle.x.toArray().join('_')}`;
                currentIds.add(tubeId);
            }
        }
        
        // Collect connection IDs for multi-child particles
        for (const particle of currentParticles) {
            if (particle.childs.length > 1) {
                const sortedChildren = [...particle.childs].sort((a, b) => {
                    if (a.isLateralBranch !== b.isLateralBranch) {
                        return a.isLateralBranch ? 1 : -1;
                    }
                    return a.x.distanceTo(particle.x) - b.x.distanceTo(particle.x);
                });
                
                for (let i = 0; i < sortedChildren.length - 1; i++) {
                    if (sortedChildren[i].x.distanceTo(sortedChildren[i+1].x) < 
                        sortedChildren[i].dimensions.x * 4) {
                        const connectionId = `${plantId}_connection_${i}_${particle.depth}`;
                        currentIds.add(connectionId);
                    }
                }
            }
        }
        
        // Remove any tubes for this plant not in the current ID set
        const tubeIdsToCheck = [...this.tubeInstanceMap.keys()].filter(id => id.startsWith(plantId));
        
        for (const tubeId of tubeIdsToCheck) {
            if (!currentIds.has(tubeId)) {
                const instanceIndex = this.tubeInstanceMap.get(tubeId);
                
                // Clear the instance by setting scale to 0
                this.dummyObject.position.set(0, 0, 0);
                this.dummyObject.scale.set(0, 0, 0);
                this.dummyObject.updateMatrix();
                this.instancedTubes.setMatrixAt(instanceIndex, this.dummyObject.matrix);
                
                // Add to free indices list for reuse
                this.freeIndices.push(instanceIndex);
                
                // Remove references
                this.tubeInstanceMap.delete(tubeId);
                this.tubeData.delete(tubeId);
            }
        }
        
        // Update matrices if needed
        if (tubeIdsToCheck.length > 0) {
            this.instancedTubes.instanceMatrix.needsUpdate = true;
        }
    }

    toggleParticleMeshes(particleGroup, visible) {
        for (const particle of particleGroup) {
            if (particle.mesh) {
                particle.mesh.visible = visible;
            }
        }
    }
    
    toggleVisibility(visible) {
        this.instancedTubes.visible = visible;
    }
    
    dispose() {
        this.scene.remove(this.instancedTubes);
        this.instancedTubes.geometry.dispose();
        this.instancedTubes.material.dispose();
        this.tubeInstanceMap.clear();
        this.tubeData.clear();
        this.instanceCount = 0;
        this.freeIndices = [];
    }
    
    setRadiusScaleFactor(factor) {
        const scaleFactor = factor / this.radiusScaleFactor;
        this.radiusScaleFactor = factor;
        
        // Update radius of all tube segments and their instances
        for (const [tubeId, tubeData] of this.tubeData.entries()) {
            // Scale the existing radius
            tubeData.radius *= scaleFactor;
            
            // Update the instance
            if (this.tubeInstanceMap.has(tubeId)) {
                const instanceIndex = this.tubeInstanceMap.get(tubeId);
                const startPoint = tubeData.startPoint;
                const endPoint = tubeData.endPoint;
                const length = startPoint.distanceTo(endPoint);
                const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
                const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
                
                this.positionTubeInstance(instanceIndex, startPoint, endPoint, midPoint, direction, length, tubeData.radius);
            }
        }
    }
}