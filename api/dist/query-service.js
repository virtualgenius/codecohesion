"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
class QueryService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }
    /**
     * Find repository by URL
     */
    async findRepoByUrl(url) {
        return this.dataLoader.findRepoByUrl(url);
    }
    /**
     * Get repository statistics
     */
    async getStats(repoId) {
        const data = await this.dataLoader.loadRepo(repoId);
        const snapshot = this.extractSnapshot(data);
        return {
            repository: {
                id: repoId,
                path: snapshot.repositoryPath
            },
            analyzedAt: snapshot.timestamp,
            commit: snapshot.commit,
            stats: snapshot.stats
        };
    }
    /**
     * Get contributors with optional date filtering and limit
     */
    async getContributors(repoId, since, until, limit) {
        const data = await this.dataLoader.loadRepo(repoId);
        const snapshot = this.extractSnapshot(data);
        const contributorMap = new Map();
        this.traverseTree(snapshot.tree, (node) => {
            if (node.type === 'file' && node.lastAuthor) {
                // Filter by date range if specified
                if (!this.isWithinDateRange(node.lastModified, since, until)) {
                    return;
                }
                const existing = contributorMap.get(node.lastAuthor) || {
                    email: node.lastAuthor,
                    filesChanged: 0,
                    lastModified: node.lastModified || ''
                };
                existing.filesChanged++;
                if (node.lastModified && node.lastModified > existing.lastModified) {
                    existing.lastModified = node.lastModified;
                }
                contributorMap.set(node.lastAuthor, existing);
            }
        });
        const sortedContributors = Array.from(contributorMap.values())
            .sort((a, b) => b.filesChanged - a.filesChanged);
        const contributors = limit
            ? sortedContributors.slice(0, limit)
            : sortedContributors;
        return {
            repository: { id: repoId },
            period: { since, until, limit },
            contributors,
            total: contributorMap.size
        };
    }
    /**
     * Get files with optional path filtering and sorting
     */
    async getFiles(repoId, pathFilter, metric) {
        const data = await this.dataLoader.loadRepo(repoId);
        const snapshot = this.extractSnapshot(data);
        const files = [];
        this.traverseTree(snapshot.tree, (node) => {
            if (node.type === 'file') {
                if (pathFilter && !node.path.startsWith(pathFilter))
                    return;
                files.push(node);
            }
        });
        // Sort by metric if provided
        if (metric === 'churn') {
            files.sort((a, b) => (b.commitCount || 0) - (a.commitCount || 0));
        }
        else if (metric === 'contributors') {
            files.sort((a, b) => (b.contributorCount || 0) - (a.contributorCount || 0));
        }
        else if (metric === 'loc') {
            files.sort((a, b) => b.loc - a.loc);
        }
        else if (metric === 'age') {
            files.sort((a, b) => {
                if (!a.firstCommitDate || !b.firstCommitDate)
                    return 0;
                return new Date(a.firstCommitDate).getTime() - new Date(b.firstCommitDate).getTime();
            });
        }
        return { files, total: files.length };
    }
    /**
     * Get hotspot files (high churn and high contributor count)
     */
    async getHotspots(repoId, limit = 20) {
        const { files } = await this.getFiles(repoId);
        const topChurn = files
            .filter(f => f.commitCount)
            .sort((a, b) => (b.commitCount || 0) - (a.commitCount || 0))
            .slice(0, limit);
        const topContributors = files
            .filter(f => f.contributorCount)
            .sort((a, b) => (b.contributorCount || 0) - (a.contributorCount || 0))
            .slice(0, limit);
        return {
            topChurn,
            topContributors
        };
    }
    /**
     * Extract snapshot from Timeline or static format
     */
    extractSnapshot(data) {
        return 'headSnapshot' in data ? data.headSnapshot : data;
    }
    /**
     * Traverse tree recursively and call callback for each node
     */
    traverseTree(node, callback) {
        callback(node);
        if (node.type === 'directory') {
            node.children.forEach(child => this.traverseTree(child, callback));
        }
    }
    /**
     * Check if date is within range
     */
    isWithinDateRange(dateStr, since, until) {
        if (!dateStr)
            return false;
        const date = new Date(dateStr);
        if (since && date < new Date(since))
            return false;
        if (until && date > new Date(until))
            return false;
        return true;
    }
}
exports.QueryService = QueryService;
