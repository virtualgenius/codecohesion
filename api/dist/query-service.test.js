"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const path_1 = __importDefault(require("path"));
const data_loader_1 = require("./data-loader");
const query_service_1 = require("./query-service");
(0, vitest_1.describe)('QueryService', () => {
    let queryService;
    let testRepoId;
    (0, vitest_1.beforeAll)(async () => {
        const testDataDir = path_1.default.join(__dirname, '../test/data');
        const dataLoader = new data_loader_1.DataLoader(testDataDir);
        queryService = new query_service_1.QueryService(dataLoader);
        // Use static format test fixture (has tree data)
        const repos = await dataLoader.listRepos();
        const staticRepo = repos.find(r => r.name.includes('static'));
        if (!staticRepo)
            throw new Error('Static test fixture not found');
        testRepoId = staticRepo.id;
    });
    (0, vitest_1.describe)('getStats', () => {
        (0, vitest_1.it)('should return repository statistics', async () => {
            const stats = await queryService.getStats(testRepoId);
            (0, vitest_1.expect)(stats).toHaveProperty('repository');
            (0, vitest_1.expect)(stats).toHaveProperty('analyzedAt');
            (0, vitest_1.expect)(stats).toHaveProperty('commit');
            (0, vitest_1.expect)(stats).toHaveProperty('stats');
            (0, vitest_1.expect)(stats.repository.id).toBe(testRepoId);
            (0, vitest_1.expect)(stats.stats).toHaveProperty('totalFiles');
            (0, vitest_1.expect)(stats.stats).toHaveProperty('totalLoc');
            (0, vitest_1.expect)(stats.stats).toHaveProperty('filesByExtension');
            (0, vitest_1.expect)(stats.stats.totalFiles).toBeGreaterThan(0);
            (0, vitest_1.expect)(stats.stats.totalLoc).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should throw error for non-existent repository', async () => {
            await (0, vitest_1.expect)(queryService.getStats('non-existent')).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('getContributors', () => {
        (0, vitest_1.it)('should return all contributors without date filter', async () => {
            const result = await queryService.getContributors(testRepoId);
            (0, vitest_1.expect)(result).toHaveProperty('repository');
            (0, vitest_1.expect)(result).toHaveProperty('contributors');
            (0, vitest_1.expect)(result).toHaveProperty('total');
            (0, vitest_1.expect)(result.contributors).toBeInstanceOf(Array);
            (0, vitest_1.expect)(result.total).toBeGreaterThan(0);
            const contributor = result.contributors[0];
            (0, vitest_1.expect)(contributor).toHaveProperty('email');
            (0, vitest_1.expect)(contributor).toHaveProperty('filesChanged');
            (0, vitest_1.expect)(contributor).toHaveProperty('lastModified');
        });
        (0, vitest_1.it)('should sort contributors by filesChanged descending', async () => {
            const result = await queryService.getContributors(testRepoId);
            if (result.contributors.length > 1) {
                const first = result.contributors[0];
                const second = result.contributors[1];
                (0, vitest_1.expect)(first.filesChanged).toBeGreaterThanOrEqual(second.filesChanged);
            }
        });
        (0, vitest_1.it)('should filter contributors by date range', async () => {
            const allContributors = await queryService.getContributors(testRepoId);
            // Filter to last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const since = thirtyDaysAgo.toISOString().split('T')[0];
            const filtered = await queryService.getContributors(testRepoId, since);
            // Filtered result should have same or fewer contributors
            (0, vitest_1.expect)(filtered.total).toBeLessThanOrEqual(allContributors.total);
            (0, vitest_1.expect)(filtered.period.since).toBe(since);
        });
    });
    (0, vitest_1.describe)('getFiles', () => {
        (0, vitest_1.it)('should return all files', async () => {
            const result = await queryService.getFiles(testRepoId);
            (0, vitest_1.expect)(result).toHaveProperty('files');
            (0, vitest_1.expect)(result).toHaveProperty('total');
            (0, vitest_1.expect)(result.files).toBeInstanceOf(Array);
            (0, vitest_1.expect)(result.total).toBeGreaterThan(0);
            const file = result.files[0];
            (0, vitest_1.expect)(file).toHaveProperty('path');
            (0, vitest_1.expect)(file).toHaveProperty('name');
            (0, vitest_1.expect)(file).toHaveProperty('type');
            (0, vitest_1.expect)(file.type).toBe('file');
        });
        (0, vitest_1.it)('should filter files by path prefix', async () => {
            const allFiles = await queryService.getFiles(testRepoId);
            const firstFilePath = allFiles.files[0].path;
            const pathPrefix = firstFilePath.split('/')[0];
            const filtered = await queryService.getFiles(testRepoId, pathPrefix);
            (0, vitest_1.expect)(filtered.total).toBeLessThanOrEqual(allFiles.total);
            filtered.files.forEach(file => {
                (0, vitest_1.expect)(file.path).toMatch(new RegExp(`^${pathPrefix}`));
            });
        });
        (0, vitest_1.it)('should sort files by churn (commitCount)', async () => {
            const result = await queryService.getFiles(testRepoId, undefined, 'churn');
            if (result.files.length > 1) {
                const filesWithChurn = result.files.filter(f => f.commitCount !== null);
                if (filesWithChurn.length > 1) {
                    const first = filesWithChurn[0];
                    const second = filesWithChurn[1];
                    (0, vitest_1.expect)(first.commitCount).toBeGreaterThanOrEqual(second.commitCount);
                }
            }
        });
        (0, vitest_1.it)('should sort files by contributors', async () => {
            const result = await queryService.getFiles(testRepoId, undefined, 'contributors');
            if (result.files.length > 1) {
                const filesWithContributors = result.files.filter(f => f.contributorCount !== null);
                if (filesWithContributors.length > 1) {
                    const first = filesWithContributors[0];
                    const second = filesWithContributors[1];
                    (0, vitest_1.expect)(first.contributorCount).toBeGreaterThanOrEqual(second.contributorCount);
                }
            }
        });
        (0, vitest_1.it)('should sort files by LOC', async () => {
            const result = await queryService.getFiles(testRepoId, undefined, 'loc');
            if (result.files.length > 1) {
                const first = result.files[0];
                const second = result.files[1];
                (0, vitest_1.expect)(first.loc).toBeGreaterThanOrEqual(second.loc);
            }
        });
    });
    (0, vitest_1.describe)('getHotspots', () => {
        (0, vitest_1.it)('should return top churn and top contributor files', async () => {
            const result = await queryService.getHotspots(testRepoId, 10);
            (0, vitest_1.expect)(result).toHaveProperty('topChurn');
            (0, vitest_1.expect)(result).toHaveProperty('topContributors');
            (0, vitest_1.expect)(result.topChurn).toBeInstanceOf(Array);
            (0, vitest_1.expect)(result.topContributors).toBeInstanceOf(Array);
            (0, vitest_1.expect)(result.topChurn.length).toBeLessThanOrEqual(10);
            (0, vitest_1.expect)(result.topContributors.length).toBeLessThanOrEqual(10);
        });
        (0, vitest_1.it)('should respect limit parameter', async () => {
            const result = await queryService.getHotspots(testRepoId, 5);
            (0, vitest_1.expect)(result.topChurn.length).toBeLessThanOrEqual(5);
            (0, vitest_1.expect)(result.topContributors.length).toBeLessThanOrEqual(5);
        });
        (0, vitest_1.it)('should sort topChurn by commitCount descending', async () => {
            const result = await queryService.getHotspots(testRepoId, 10);
            if (result.topChurn.length > 1) {
                const first = result.topChurn[0];
                const second = result.topChurn[1];
                (0, vitest_1.expect)(first.commitCount).toBeGreaterThanOrEqual(second.commitCount);
            }
        });
        (0, vitest_1.it)('should sort topContributors by contributorCount descending', async () => {
            const result = await queryService.getHotspots(testRepoId, 10);
            if (result.topContributors.length > 1) {
                const first = result.topContributors[0];
                const second = result.topContributors[1];
                (0, vitest_1.expect)(first.contributorCount).toBeGreaterThanOrEqual(second.contributorCount);
            }
        });
    });
    (0, vitest_1.describe)('findRepoByUrl', () => {
        (0, vitest_1.it)('should find repository by URL', async () => {
            const repo = await queryService.findRepoByUrl('https://github.com/test/ecommerce');
            (0, vitest_1.expect)(repo).toBeDefined();
            (0, vitest_1.expect)(repo?.id).toContain('ecommerce');
        });
    });
});
