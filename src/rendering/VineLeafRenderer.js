import * as THREE from "three";
import { Particle } from "../components/Particle"; 

export class VineLeafRenderer {
    constructor(scene) {
        this.scene = scene;
        this.leaves = new Map(); // Maps particle IDs to leaf meshes
        this.leafData = new Map(); // Stores persistent data for each leaf
        
        this.leafMaterial = new THREE.MeshStandardMaterial({
            color: 0x66aa44, // green
            roughness: 0.7,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });
        
        // Leaf settings
        this.leafSize = 0.25;
        this.leafDensity = 0.6; // Probability of a particle having leaves
        this.leavesPerNode = { min: 1, max: 3 };
    }
    
    createLeafShape() {
        // Create a custom shape for the leaf
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
            // Use a hash of the particle depth to create variation in which segments have leaves
            const shouldSkip = ((particle.depth * 13) % 5) < 2; // Skip ~40% of particles
            if (shouldSkip) {
                continue;
            }
            
            // Use particle's unique ID for leaf mapping
            const particleId = `${plantId}_${particle.depth}_${particle.x.toArray().join('_')}`;
            
            // Check if this particle already has leaves
            if (!this.leaves.has(particleId)) {
                // Randomly decide if this particle should have leaves
                if (Math.random() < this.leafDensity) {
                    // Determine number of leaves for this node (with natural variation)
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
    }

    createLeavesForParticle(particle, particleId, leafCount) {
        const leafMeshes = [];
        
        // Store data for this particle's leaves
        this.leafData.set(particleId, {
            particlePosition: particle.x.clone(),
            stemDirection: particle.getDir().clone(),
            anglesAndOffsets: []
        });
        
        // Generate random but well-distributed angles for natural appearance
        const baseAngles = this.generateNaturalAngles(leafCount);
        
        for (let i = 0; i < leafCount; i++) {
            // Create a leaf-shaped geometry
            const leafGeometry = this.createLeafShape();
            
            // Create a new leaf mesh
            const leafMesh = new THREE.Mesh(
                leafGeometry,
                this.leafMaterial
            );
            
            // Generate and store random angles and offsets for this leaf
            // Add random variation to the base angle for natural look
            const angleAround = baseAngles[i] + (Math.random() * 0.3 - 0.15);
            
            // Tilt varies slightly for each leaf
            const tiltAngle = Math.PI/2 + (Math.random() * 0.4 - 0.2);
            
            // Height offset along stem
            const heightOffset = (Math.random() - 0.5) * 0.2;
            
            // Scale variation for each leaf
            const scaleVariation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
            
            this.leafData.get(particleId).anglesAndOffsets.push({
                angleAround,
                tiltAngle,
                heightOffset,
                scaleVariation
            });
            
            // Position and orient the leaf
            this.positionLeafWithFixedAngles(
                leafMesh, 
                particle, 
                angleAround, 
                tiltAngle, 
                heightOffset,
                scaleVariation
            );
            
            // Add to scene
            leafMesh.castShadow = true;
            leafMesh.receiveShadow = true;
            this.scene.add(leafMesh);
            
            leafMeshes.push(leafMesh);
        }
        
        // Store the leaves for this particle
        this.leaves.set(particleId, leafMeshes);
    }
    
    generateNaturalAngles(count) {
        const angles = [];
        
        const randomStart = Math.random() * Math.PI * 2;
        
        if (count === 1) {
            // For a single leaf, pick a random angle
            angles.push(randomStart);
        } 
        else if (count === 2) {
            // For two leaves, put them roughly opposite but with variation
            // Instead of exact 180° separation, use 150-210°
            const separation = Math.PI * (1.5 + Math.random() * 0.6);
            angles.push(randomStart);
            angles.push(randomStart + separation);
        }
        else {
            // First leaf at random position
            angles.push(randomStart);
            
            if (count >= 3) {
                // Create a cluster of 2 leaves on one side
                const cluster1 = randomStart + (Math.PI * 0.3);
                angles.push(cluster1);
                
                // Put the third leaf more distant
                const leaf3 = randomStart + Math.PI * (1.2 + Math.random() * 0.4);
                angles.push(leaf3);
                
                // Add more leaves if needed
                for (let i = 3; i < count; i++) {
                    angles.push(randomStart + (Math.PI * 2 * Math.random()));
                }
            } else {
                // Distribute remaining leaves with variation
                for (let i = 1; i < count; i++) {
                    angles.push(randomStart + (Math.PI * 2 * i / count) + (Math.random() * 0.5 - 0.25));
                }
            }
        }
        
        return angles;
    }
    
    updateLeavesForParticle(particle, particleId) {
        const leafMeshes = this.leaves.get(particleId);
        const leafData = this.leafData.get(particleId);
        
        if (!leafMeshes || !leafData || !leafData.anglesAndOffsets) return;
        
        for (let i = 0; i < leafMeshes.length; i++) {
            const angleData = leafData.anglesAndOffsets[i];
            if (angleData) {
                this.positionLeafWithFixedAngles(
                    leafMeshes[i], 
                    particle, 
                    angleData.angleAround,
                    angleData.tiltAngle,
                    angleData.heightOffset,
                    angleData.scaleVariation
                );
            }
        }
    }
    
    positionLeafWithFixedAngles(leafMesh, particle, angleAround, tiltAngle, heightOffset, scaleVariation) {
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
        const offsetDistance = 0.12 + Math.random() * 0.08; // 0.12-0.2 offset for 0.1 radius vines
        const leafPosition = particle.x.clone().add(
            perpVector.clone().multiplyScalar(offsetDistance)
        );
        
        // Apply height offset along stem
        leafPosition.add(stemDirection.clone().multiplyScalar(heightOffset));
        

        leafMesh.position.copy(leafPosition);
        
        // Create a rotation matrix to orient the leaf perpendicular to the stem
        leafMesh.lookAt(leafPosition.clone().add(perpVector));
        const localXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(leafMesh.quaternion);
        const tiltCorrection = new THREE.Quaternion().setFromAxisAngle(localXAxis, tiltAngle);
        leafMesh.quaternion.multiply(tiltCorrection);
        
        // Apply a small random rotation for natural variation
        const twistAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(leafMesh.quaternion);
        const twistAmount = (Math.random() * 0.3 - 0.15);
        const twistQuaternion = new THREE.Quaternion().setFromAxisAngle(twistAxis, twistAmount);
        leafMesh.quaternion.multiply(twistQuaternion);
        
        // Apply scale
        leafMesh.scale.set(scaleVariation, scaleVariation, scaleVariation);
    }
    
    cleanupUnusedLeaves(currentParticles, plantId) {
        // Collect all current particle IDs
        const currentIds = new Set();
        for (const particle of currentParticles) {
            const particleId = `${plantId}_${particle.depth}_${particle.x.toArray().join('_')}`;
            currentIds.add(particleId);
        }
        
        // Remove leaves for particles that no longer exist
        const leafIdsToCheck = [...this.leaves.keys()].filter(id => id.startsWith(plantId));
        
        for (const leafId of leafIdsToCheck) {
            if (!currentIds.has(leafId)) {
                const leafMeshes = this.leaves.get(leafId);
                if (leafMeshes) {
                    for (const leafMesh of leafMeshes) {
                        this.scene.remove(leafMesh);
                        leafMesh.geometry.dispose();
                    }
                }
                this.leaves.delete(leafId);
                this.leafData.delete(leafId);
            }
        }
    }
    
    toggleLeafVisibility(visible) {
        for (const leafMeshes of this.leaves.values()) {
            for (const leafMesh of leafMeshes) {
                leafMesh.visible = visible;
            }
        }
    }
    
    dispose() {
        for (const leafMeshes of this.leaves.values()) {
            for (const leafMesh of leafMeshes) {
                this.scene.remove(leafMesh);
                leafMesh.geometry.dispose();
            }
        }
        this.leaves.clear();
        this.leafData.clear();
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
    
    // If leaf size changes
    rebuildAllLeaves() {
        // Get all particles with leaves
        const leafIds = [...this.leaves.keys()];
        
        for (const leafId of leafIds) {
            const leafMeshes = this.leaves.get(leafId);
            const leafData = this.leafData.get(leafId);
            
            if (!leafMeshes || !leafData || !leafData.anglesAndOffsets) continue;
            
            // Dispose old geometry
            for (const leafMesh of leafMeshes) {
                leafMesh.geometry.dispose();
                
                // Create new leaf geometry
                const newGeometry = this.createLeafShape();
                leafMesh.geometry = newGeometry;
            }
        }
    }
}