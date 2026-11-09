/**
 * ============================================================================
 * CONSTRAINT GRAPH (ConstraintGraph.js)
 * Topology & Island Management for Rigging Assemblies
 * Ensures Zero-Floating Guarantee & Connected Component Wake-Up
 * ============================================================================
 */

export class ConstraintGraph {
    constructor(rootId = 'crane_hook') {
        this.rootId = rootId;
        /** @type {Set<string>} */
        this.nodes = new Set();
        /** @type {Map<string, Set<string>>} */
        this.adjacency = new Map();
        /** @type {Map<string, Object>} */
        this.constraints = new Map();
    }

    addNode(nodeId) {
        this.nodes.add(nodeId);
        if (!this.adjacency.has(nodeId)) {
            this.adjacency.set(nodeId, new Set());
        }
    }

    removeNode(nodeId) {
        this.nodes.delete(nodeId);
        const neighbors = this.adjacency.get(nodeId);
        if (neighbors) {
            for (const neighbor of neighbors) {
                const nSet = this.adjacency.get(neighbor);
                if (nSet) nSet.delete(nodeId);
            }
            this.adjacency.delete(nodeId);
        }
        // Remove attached constraints
        for (const [cId, c] of this.constraints) {
            if (c.bodyA === nodeId || c.bodyB === nodeId) {
                this.constraints.delete(cId);
            }
        }
    }

    addConstraint(constraint) {
        const { id, bodyA, bodyB } = constraint;
        this.addNode(bodyA);
        this.addNode(bodyB);

        this.constraints.set(id, constraint);
        this.adjacency.get(bodyA).add(bodyB);
        this.adjacency.get(bodyB).add(bodyA);
    }

    removeConstraint(constraintId) {
        const c = this.constraints.get(constraintId);
        if (!c) return;

        this.constraints.delete(constraintId);
        const { bodyA, bodyB } = c;

        // Check if there are other constraints between bodyA and bodyB
        let hasOther = false;
        for (const other of this.constraints.values()) {
            if (!other.broken && ((other.bodyA === bodyA && other.bodyB === bodyB) || (other.bodyA === bodyB && other.bodyB === bodyA))) {
                hasOther = true;
                break;
            }
        }

        if (!hasOther) {
            const setA = this.adjacency.get(bodyA);
            if (setA) setA.delete(bodyB);
            const setB = this.adjacency.get(bodyB);
            if (setB) setB.delete(bodyA);
        }
    }

    getConstraint(id) {
        return this.constraints.get(id);
    }

    getAllConstraints() {
        return Array.from(this.constraints.values());
    }

    getActiveConstraints() {
        return Array.from(this.constraints.values()).filter(c => !c.broken);
    }

    /**
     * Finds all nodes connected to a starting node via active constraints
     * @param {string} startNodeId
     * @returns {Set<string>}
     */
    getIsland(startNodeId) {
        const visited = new Set();
        if (!this.nodes.has(startNodeId)) return visited;

        const queue = [startNodeId];
        visited.add(startNodeId);

        while (queue.length > 0) {
            const curr = queue.shift();
            // Get active neighbors
            for (const c of this.constraints.values()) {
                if (c.broken) continue;
                let neighbor = null;
                if (c.bodyA === curr) neighbor = c.bodyB;
                else if (c.bodyB === curr) neighbor = c.bodyA;

                if (neighbor && !visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        return visited;
    }

    /**
     * Wakes up all bodies in the same connected island
     * @param {string} nodeId
     * @param {import('./IPhysicsBackend.js').IPhysicsBackend} backend
     */
    wakeUpIsland(nodeId, backend) {
        const island = this.getIsland(nodeId);
        for (const id of island) {
            backend.wakeUp(id);
        }
    }

    /**
     * Checks if a body is connected to the crane hook root
     * @param {string} nodeId
     * @returns {boolean}
     */
    isReachableFromRoot(nodeId) {
        if (nodeId === this.rootId) return true;
        const island = this.getIsland(this.rootId);
        return island.has(nodeId);
    }

    /**
     * Returns all dynamic nodes that have lost connection to the hook
     * @returns {string[]}
     */
    getOrphanedNodes() {
        const rootIsland = this.getIsland(this.rootId);
        const orphaned = [];
        for (const id of this.nodes) {
            if (id !== this.rootId && !rootIsland.has(id)) {
                orphaned.push(id);
            }
        }
        return orphaned;
    }
}
