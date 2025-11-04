"use strict";
/**
 * Temporal Coupling Analyzer
 *
 * Analyzes git history to detect files that change together over time.
 * Uses Louvain clustering to identify potential bounded contexts.
 *
 * Based on research from:
 * - CodeScene's temporal coupling analysis
 * - "Microservice Decomposition via Static and Dynamic Analysis" (2020)
 * - DDD-VISION.md Level 1: File Co-Change Analysis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouplingAnalyzer = void 0;
const graphology_1 = __importDefault(require("graphology"));
const graphology_communities_louvain_1 = __importDefault(require("graphology-communities-louvain"));
class CouplingAnalyzer {
    constructor() {
        // Configuration parameters
        this.MIN_COUPLING_THRESHOLD = 0.1; // Ignore weak coupling (< 10%)
        this.MIN_CLUSTER_SIZE = 2; // Ignore single-file clusters
        this.MAX_EDGES_OUTPUT = 10000; // Prevent huge output files
        this.MIN_COCHANGE_COUNT = 2; // Must change together at least twice
        // Internal state
        this.coChangeMatrix = new Map();
        this.fileChangeCounts = new Map();
    }
    /**
     * Analyze temporal coupling from timeline data
     */
    analyze(timeline, timelineFilePath) {
        console.log(`\n🔍 Analyzing temporal coupling...`);
        console.log(`   Repository: ${timeline.repositoryPath}`);
        console.log(`   Commits: ${timeline.commits.length}`);
        // Validate input format
        if (timeline.format !== 'timeline') {
            throw new Error(`Invalid format: ${timeline.format}. Expected 'timeline'`);
        }
        // Step 1: Build co-change matrix from commit history
        this.buildCoChangeMatrix(timeline.commits);
        // Step 2: Calculate coupling scores (Jaccard similarity)
        const edges = this.calculateCouplingScores();
        console.log(`   Coupling edges: ${edges.length} (after filtering)`);
        // Step 3: Build graph for clustering
        const graph = this.buildGraph(edges);
        console.log(`   Graph nodes: ${graph.order}, edges: ${graph.size}`);
        // Step 4: Run Louvain clustering
        const clusters = this.clusterFiles(graph);
        console.log(`   Clusters detected: ${clusters.length}`);
        // Return complete coupling graph
        return {
            format: 'coupling-v1',
            repositoryPath: timeline.repositoryPath,
            sourceTimeline: timelineFilePath,
            analysis: {
                totalCommits: timeline.commits.length,
                filesAnalyzed: this.fileChangeCounts.size,
                couplingEdges: edges.length,
                generatedAt: new Date().toISOString(),
            },
            edges,
            clusters,
        };
    }
    /**
     * Build co-change matrix by analyzing all commits
     */
    buildCoChangeMatrix(commits) {
        console.log(`   Building co-change matrix...`);
        for (const commit of commits) {
            // Get all changed files (modified + added, exclude deleted)
            const changedFiles = [
                ...commit.changes.filesModified,
                ...commit.changes.filesAdded,
            ];
            // Skip empty commits
            if (changedFiles.length === 0)
                continue;
            // Record that each file changed
            for (const file of changedFiles) {
                this.fileChangeCounts.set(file, (this.fileChangeCounts.get(file) || 0) + 1);
            }
            // Record co-changes for every pair of files in this commit
            for (let i = 0; i < changedFiles.length; i++) {
                for (let j = i + 1; j < changedFiles.length; j++) {
                    const fileA = changedFiles[i];
                    const fileB = changedFiles[j];
                    // Store in sorted order to avoid duplicates
                    const [first, second] = fileA < fileB ? [fileA, fileB] : [fileB, fileA];
                    if (!this.coChangeMatrix.has(first)) {
                        this.coChangeMatrix.set(first, new Map());
                    }
                    const fileAEdges = this.coChangeMatrix.get(first);
                    fileAEdges.set(second, (fileAEdges.get(second) || 0) + 1);
                }
            }
        }
        console.log(`   Files tracked: ${this.fileChangeCounts.size}`);
        console.log(`   Raw co-change pairs: ${this.getTotalCoChangePairs()}`);
    }
    /**
     * Calculate coupling scores using Jaccard similarity
     */
    calculateCouplingScores() {
        console.log(`   Calculating coupling scores...`);
        const edges = [];
        for (const [fileA, fileAEdges] of this.coChangeMatrix) {
            const changesA = this.fileChangeCounts.get(fileA) || 0;
            for (const [fileB, coChangeCount] of fileAEdges) {
                const changesB = this.fileChangeCounts.get(fileB) || 0;
                // Jaccard similarity: |A ∩ B| / |A ∪ B|
                // = changes_together / (changes_to_A + changes_to_B - changes_together)
                const coupling = coChangeCount / (changesA + changesB - coChangeCount);
                // Filter out weak coupling and infrequent co-changes
                if (coupling >= this.MIN_COUPLING_THRESHOLD && coChangeCount >= this.MIN_COCHANGE_COUNT) {
                    edges.push({
                        fileA,
                        fileB,
                        coChangeCount,
                        coupling: Math.round(coupling * 1000) / 1000, // Round to 3 decimals
                    });
                }
            }
        }
        // Sort by coupling strength (strongest first) and limit output size
        edges.sort((a, b) => b.coupling - a.coupling);
        if (edges.length > this.MAX_EDGES_OUTPUT) {
            console.log(`   ⚠️  Limiting edges to top ${this.MAX_EDGES_OUTPUT} (from ${edges.length})`);
            return edges.slice(0, this.MAX_EDGES_OUTPUT);
        }
        return edges;
    }
    /**
     * Build weighted graph from coupling edges
     */
    buildGraph(edges) {
        console.log(`   Building weighted graph...`);
        const graph = new graphology_1.default({ type: 'undirected' });
        // Add all files as nodes
        for (const file of this.fileChangeCounts.keys()) {
            graph.addNode(file);
        }
        // Add edges with coupling as weight
        for (const edge of edges) {
            // Some files might not have nodes if they didn't pass the threshold
            if (graph.hasNode(edge.fileA) && graph.hasNode(edge.fileB)) {
                graph.addEdge(edge.fileA, edge.fileB, { weight: edge.coupling });
            }
        }
        return graph;
    }
    /**
     * Cluster files using Louvain community detection
     */
    clusterFiles(graph) {
        console.log(`   Running Louvain clustering...`);
        // Run Louvain algorithm
        const clusterAssignments = (0, graphology_communities_louvain_1.default)(graph, {
            resolution: 1.0, // Standard resolution (can be tuned)
        });
        // Group files by cluster ID
        const clustersMap = new Map();
        for (const [file, clusterId] of Object.entries(clusterAssignments)) {
            if (!clustersMap.has(clusterId)) {
                clustersMap.set(clusterId, []);
            }
            clustersMap.get(clusterId).push(file);
        }
        // Convert to Cluster objects
        const clusters = [];
        let clusterNumber = 1;
        for (const [clusterId, files] of clustersMap) {
            // Filter out very small clusters
            if (files.length < this.MIN_CLUSTER_SIZE) {
                continue;
            }
            clusters.push({
                id: clusterNumber++,
                name: `Cluster ${clusterNumber}`,
                files,
                fileCount: files.length,
                avgInternalCoupling: this.calculateAvgInternalCoupling(files, graph),
            });
        }
        // Sort clusters by size (largest first)
        clusters.sort((a, b) => b.fileCount - a.fileCount);
        // Renumber clusters after sorting
        clusters.forEach((cluster, index) => {
            cluster.id = index + 1;
            cluster.name = `Cluster ${index + 1}`;
        });
        return clusters;
    }
    /**
     * Calculate average coupling within a cluster
     */
    calculateAvgInternalCoupling(files, graph) {
        let totalCoupling = 0;
        let edgeCount = 0;
        for (let i = 0; i < files.length; i++) {
            for (let j = i + 1; j < files.length; j++) {
                const fileA = files[i];
                const fileB = files[j];
                if (graph.hasEdge(fileA, fileB)) {
                    const attrs = graph.getEdgeAttributes(fileA, fileB);
                    totalCoupling += attrs.weight || 0;
                    edgeCount++;
                }
            }
        }
        return edgeCount > 0 ? Math.round((totalCoupling / edgeCount) * 1000) / 1000 : 0;
    }
    /**
     * Get total number of co-change pairs (for logging)
     */
    getTotalCoChangePairs() {
        let total = 0;
        for (const fileAEdges of this.coChangeMatrix.values()) {
            total += fileAEdges.size;
        }
        return total;
    }
}
exports.CouplingAnalyzer = CouplingAnalyzer;
