import * as THREE from "three";
import { Particle } from "../components/Particle"; 

export class VineLeafRenderer {
    constructor(scene) {
        this.scene = scene;
        this.leafData = new Map(); // Stores persistent data for each leaf
        this.instanceCount = 0;
        this.maxInstances = 100000; // Maximum number of instances
        
        // Leaf settings
        this.leafSize = 0.25;
        this.leafDensity = 0.6; // Probability of a particle having leaves
        this.leavesPerNode = { min: 1, max: 3 };
        
        // Create base leaf geometry
        this.leafGeometry = this.createLeafShape();
        
        // Create instanced material
        this.leafMaterial = new THREE.MeshStandardMaterial({
            color: 0x66aa44, // green
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });
        
        // Create instanced mesh
        this.instancedLeaves = new THREE.InstancedMesh(
            this.leafGeometry,
            this.leafMaterial,
            this.maxInstances
        );
        
        this.instancedLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedLeaves.castShadow = true;
        this.instancedLeaves.receiveShadow = true;
        this.instancedLeaves.frustumCulled = false;
        
        // Add to scene
        this.scene.add(this.instancedLeaves);
        
        // Initialize instance mapping
        this.leafInstanceMap = new Map(); // Maps particle IDs to instance indices
        this.freeIndices = []; // Reusable indices from removed instances
        
        // Dummy objects for transform calculations
        this.dummyObject = new THREE.Object3D();
        this.matrix = new THREE.Matrix4();
    }

    toggleVisibility(visible) {
        this.instancedLeaves.visible = visible;
    }
    
    createLeafShape() {
        // Create a custom shape for the leaf (same as before)
        const shape = new THREE.Shape();
        
        const width = this.leafSize;
        const height = this.leafSize * 1.6;
        
        // Start at the bottom (stem attachment point)
        shape.moveTo(0, 0);
        
        // Right side of leaf
        shape.bezierCurveTo(
            width * 0.8, height * 0.3, // point 1
            width * 0.7, height * 0.7, // point 2
            0, height              // end point (tip of leaf)
        );
        
        // Left side of leaf
        shape.bezierCurveTo(
            -width * 0.7, height * 0.7, // point 1
            -width * 0.8, height * 0.3, // point 2
            0, 0                   // end point (back to stem)
        );
        
        return new THREE.ShapeGeometry(shape, 8);
    }
    
    /**
     * Update or create leaves for a particle group
     * @param {Particle[]} particleGroup - Array of all particles
     * @param {string} plantId - Unique identifier for the plant
     */
    updateLeaves(particleGroup, plantId) {
        // Clean up any old leaves that aren't needed for this plant
        this.cleanupUnusedLeaves(particleGroup, plantId);
        
        // Process each mature particle to potentially add leaves
        for (const particle of particleGroup) {
            // Skip seed particles and particles that aren't fully grown
            if (particle.isSeed || !particle.isFullyGrown()) {
                continue;
            }
            
            // Skip particles that have just branched
            if (performance.now() - particle.lastBranchTime < 500) {
                continue;
            }
            
            // Only add leaves to some particles to avoid overcrowding - with variation
            const shouldSkip = ((particle.depth * 13) % 5) < 2; // Skip ~40% of particles
            if (shouldSkip) {
                continue;
            }
            
            // Use particle's unique ID for leaf mapping
            const particleId = `${plantId}_${particle.depth}_${particle.x.toArray().join('_')}`;
            
            // Check if this particle already has leaves
            if (!this.leafInstanceMap.has(particleId)) {
                // Randomly decide if this particle should have leaves
                if (Math.random() < this.leafDensity) {
                    // Determine number of leaves for this node
                    const leafProbabilities = [0.3, 0.5, 0.2]; // 30% chance for 1, 50% for 2, 20% for 3
                    const r = Math.random();
                    let leafCount;
                    
                    if (r < leafProbabilities[0]) {
                        leafCount = 1;
                    } else if (r < leafProbabilities[0] + leafProbabilities[1]) {
                        leafCount = 2;
                    } else {
                        leafCount = 3;
                    }
                    
                    this.createLeavesForParticle(particle, particleId, leafCount);
                }
            } else {
                // Update existing leaves only when position changes
                const prevPosition = this.leafData.get(particleId)?.particlePosition;
                if (prevPosition && !particle.x.equals(prevPosition)) {
                    this.updateLeavesForParticle(particle, particleId);
                    
                    // Update stored position
                    this.leafData.get(particleId).particlePosition = particle.x.clone();
                }
            }
        }
        
        // Update instanced mesh visibility - needed if max count changed
        this.instancedLeaves.count = this.instanceCount;
    }

    createLeavesForParticle(particle, particleId, leafCount) {
        // Check if we have capacity for more leaves
        if (this.instanceCount + leafCount > this.maxInstances) {
            console.warn('Maximum leaf instance count reached');
            return;
        }
        
        const instanceIndices = [];
        
        // Store data for this particle's leaves
        this.leafData.set(particleId, {
            particlePosition: particle.x.clone(),
            stemDirection: particle.getDir().clone(),
            instanceIndices: instanceIndices,
            anglesAndOffsets: []
        });
        
        // Generate random but well-distributed angles for natural appearance
        const baseAngles = this.generateNaturalAngles(leafCount);
        
        for (let i = 0; i < leafCount; i++) {
            // Get next available instance index
            let instanceIndex;
            if (this.freeIndices.length > 0) {
                instanceIndex = this.freeIndices.pop();
            } else {
                instanceIndex = this.instanceCount++;
            }
            
            instanceIndices.push(instanceIndex);
            
            // Generate and store random angles and offsets for this leaf
            const angleAround = baseAngles[i] + (Math.random() * 0.3 - 0.15);
            const tiltAngle = Math.PI/4 + (Math.random() * 0.4 - 0.2);
            const heightOffset = (Math.random() - 0.5) * 0.2;
            const scaleVariation = 0.7 + Math.random() * 0.6;
            
            this.leafData.get(particleId).anglesAndOffsets.push({
                angleAround,
                tiltAngle,
                heightOffset,
                scaleVariation
            });
            
            // Position and orient the leaf instance
            this.positionLeafInstance(
                instanceIndex, 
                particle, 
                angleAround, 
                tiltAngle, 
                heightOffset,
                scaleVariation
            );
        }
        
        // Store the instance indices for this particle
        this.leafInstanceMap.set(particleId, instanceIndices);
    }
    
    generateNaturalAngles(count) {
        // Same as original implementation
        const angles = [];
        const randomStart = Math.random() * Math.PI * 2;
        
        if (count === 1) {
            angles.push(randomStart);
        } 
        else if (count === 2) {
            const separation = Math.PI * (1.5 + Math.random() * 0.6);
            angles.push(randomStart);
            angles.push(randomStart + separation);
        }
        else {
            angles.push(randomStart);
            
            if (count >= 3) {
                const cluster1 = randomStart + (Math.PI * 0.3);
                angles.push(cluster1);
                
                const leaf3 = randomStart + Math.PI * (1.2 + Math.random() * 0.4);
                angles.push(leaf3);
                
                for (let i = 3; i < count; i++) {
                    angles.push(randomStart + (Math.PI * 2 * Math.random()));
                }
            } else {
                for (let i = 1; i < count; i++) {
                    angles.push(randomStart + (Math.PI * 2 * i / count) + (Math.random() * 0.5 - 0.25));
                }
            }
        }
        
        return angles;
    }
    
    updateLeavesForParticle(particle, particleId) {
        const leafData = this.leafData.get(particleId);
        if (!leafData || !leafData.instanceIndices || !leafData.anglesAndOffsets) return;
        
        const instanceIndices = leafData.instanceIndices;
        
        for (let i = 0; i < instanceIndices.length; i++) {
            const instanceIndex = instanceIndices[i];
            const angleData = leafData.anglesAndOffsets[i];
            
            if (angleData) {
                this.positionLeafInstance(
                    instanceIndex, 
                    particle, 
                    angleData.angleAround,
                    angleData.tiltAngle,
                    angleData.heightOffset,
                    angleData.scaleVariation
                );
            }
        }
    }
    
    positionLeafInstance(instanceIndex, particle, angleAround, tiltAngle, heightOffset, scaleVariation) {
        const stemDirection = particle.getDir().normalize();
        const stemRotation = new THREE.Quaternion().setFromAxisAngle(stemDirection, angleAround);
        
        // Get a consistent perpendicular vector
        const right = new THREE.Vector3(1, 0, 0);
        if (Math.abs(stemDirection.dot(right)) > 0.9) {
            right.set(0, 1, 0); // Use up vector if stem is along x-axis
        }
        
        // Create perpendicular vector and apply stem rotation
        const perpVector = right.clone().cross(stemDirection).normalize();
        perpVector.applyQuaternion(stemRotation);
        
        // Position leaf perpendicular to the stem
        const offsetDistance = 0.12;
        const leafPosition = particle.x.clone().add(
            perpVector.clone().multiplyScalar(offsetDistance)
        );
        
        // Apply height offset along stem
        leafPosition.add(stemDirection.clone().multiplyScalar(heightOffset));
        
        // Reset dummy object
        this.dummyObject.position.copy(leafPosition);
        this.dummyObject.scale.set(scaleVariation, scaleVariation, scaleVariation);
        
        // Orient leaf
        this.dummyObject.lookAt(leafPosition.clone().add(perpVector));
        const lookAtQuaternion = this.dummyObject.quaternion.clone();
        
        // Apply tilt
        const localXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(lookAtQuaternion);
        const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(localXAxis, tiltAngle);
        this.dummyObject.quaternion.copy(lookAtQuaternion).multiply(tiltQuaternion);
        
        // Apply random twist
        const twistAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.dummyObject.quaternion);
        const twistAmount = (Math.random() * 0.3 - 0.15);
        const twistQuaternion = new THREE.Quaternion().setFromAxisAngle(twistAxis, twistAmount);
        this.dummyObject.quaternion.multiply(twistQuaternion);
        
        // Update the instance matrix
        this.dummyObject.updateMatrix();
        this.instancedLeaves.setMatrixAt(instanceIndex, this.dummyObject.matrix);
        this.instancedLeaves.instanceMatrix.needsUpdate = true;
    }
    
    cleanupUnusedLeaves(currentParticles, plantId) {
        // Collect all current particle IDs
        const currentIds = new Set();
        for (const particle of currentParticles) {
            const particleId = `${plantId}_${particle.depth}_${particle.x.toArray().join('_')}`;
            currentIds.add(particleId);
        }
        
        // Remove leaves for particles that no longer exist
        const leafIdsToCheck = [...this.leafInstanceMap.keys()].filter(id => id.startsWith(plantId));
        
        for (const leafId of leafIdsToCheck) {
            if (!currentIds.has(leafId)) {
                const instanceIndices = this.leafInstanceMap.get(leafId);
                if (instanceIndices) {
                    // Recycle instance indices
                    for (const index of instanceIndices) {
                        // Clear the instance by setting scale to 0
                        this.dummyObject.position.set(0, 0, 0);
                        this.dummyObject.scale.set(0, 0, 0);
                        this.dummyObject.updateMatrix();
                        this.instancedLeaves.setMatrixAt(index, this.dummyObject.matrix);
                        
                        // Add to free indices list for reuse
                        this.freeIndices.push(index);
                    }
                    this.instancedLeaves.instanceMatrix.needsUpdate = true;
                }
                this.leafInstanceMap.delete(leafId);
                this.leafData.delete(leafId);
            }
        }
    }
    
    toggleLeafVisibility(visible) {
        this.instancedLeaves.visible = visible;
    }
    
    dispose() {
        this.scene.remove(this.instancedLeaves);
        this.instancedLeaves.geometry.dispose();
        this.instancedLeaves.material.dispose();
        this.leafInstanceMap.clear();
        this.leafData.clear();
        this.instanceCount = 0;
        this.freeIndices = [];
    }
    
    updateSettings(settings) {
        let needsRebuild = false;
        
        if (settings.leafSize !== undefined && this.leafSize !== settings.leafSize) {
            this.leafSize = settings.leafSize;
            needsRebuild = true;
        }
        
        if (settings.leafDensity !== undefined) {
            this.leafDensity = settings.leafDensity;
        }
        
        if (settings.leavesPerNode !== undefined) {
            this.leavesPerNode = settings.leavesPerNode;
        }
        
        if (settings.leafColor !== undefined) {
            this.leafMaterial.color.set(settings.leafColor);
        }
        
        // If leaf size changed, we need to rebuild the leaves
        if (needsRebuild) {
            this.rebuildAllLeaves();
        }
    }
    
    // If leaf size changes, rebuild the geometry
    rebuildAllLeaves() {
        // Dispose old geometry
        this.instancedLeaves.geometry.dispose();
        
        // Create new geometry with updated size
        this.leafGeometry = this.createLeafShape();
        
        // Create new instanced mesh with the updated geometry
        const newInstancedLeaves = new THREE.InstancedMesh(
            this.leafGeometry,
            this.leafMaterial,
            this.maxInstances
        );
        
        newInstancedLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        newInstancedLeaves.castShadow = true;
        newInstancedLeaves.receiveShadow = true;
        
        // Copy instance matrices from old to new
        for (let i = 0; i < this.instanceCount; i++) {
            this.instancedLeaves.getMatrixAt(i, this.matrix);
            newInstancedLeaves.setMatrixAt(i, this.matrix);
        }
        
        newInstancedLeaves.count = this.instanceCount;
        newInstancedLeaves.instanceMatrix.needsUpdate = true;
        
        // Replace old mesh with new one
        this.scene.remove(this.instancedLeaves);
        this.scene.add(newInstancedLeaves);
        this.instancedLeaves = newInstancedLeaves;
    }
}