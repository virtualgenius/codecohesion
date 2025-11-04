"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const path_1 = __importDefault(require("path"));
const data_loader_1 = require("./data-loader");
(0, vitest_1.describe)('DataLoader', () => {
    let dataLoader;
    (0, vitest_1.beforeAll)(() => {
        // Use test fixtures directory
        const testDataDir = path_1.default.join(__dirname, '../test/data');
        dataLoader = new data_loader_1.DataLoader(testDataDir);
    });
    (0, vitest_1.describe)('listRepos', () => {
        (0, vitest_1.it)('should list available repositories', async () => {
            const repos = await dataLoader.listRepos();
            (0, vitest_1.expect)(repos).toBeInstanceOf(Array);
            (0, vitest_1.expect)(repos.length).toBeGreaterThan(0);
            const repo = repos[0];
            (0, vitest_1.expect)(repo).toHaveProperty('id');
            (0, vitest_1.expect)(repo).toHaveProperty('name');
            (0, vitest_1.expect)(repo).toHaveProperty('format');
        });
        (0, vitest_1.it)('should detect static format', async () => {
            const repos = await dataLoader.listRepos();
            const staticRepo = repos.find(r => r.name.includes('static'));
            (0, vitest_1.expect)(staticRepo).toBeDefined();
            (0, vitest_1.expect)(staticRepo?.format).toBe('static');
        });
        (0, vitest_1.it)('should detect timeline-v2 format', async () => {
            const repos = await dataLoader.listRepos();
            const timelineRepo = repos.find(r => r.name.includes('timeline'));
            (0, vitest_1.expect)(timelineRepo).toBeDefined();
            (0, vitest_1.expect)(timelineRepo?.format).toBe('timeline-v2');
        });
    });
    (0, vitest_1.describe)('loadRepo', () => {
        (0, vitest_1.it)('should load repository by ID (static format)', async () => {
            const repos = await dataLoader.listRepos();
            const staticRepo = repos.find(r => r.name.includes('static'));
            if (!staticRepo)
                throw new Error('Static test fixture not found');
            const data = await dataLoader.loadRepo(staticRepo.id);
            (0, vitest_1.expect)(data).toBeDefined();
            (0, vitest_1.expect)(data).toHaveProperty('tree');
        });
        (0, vitest_1.it)('should throw error for non-existent repository', async () => {
            await (0, vitest_1.expect)(dataLoader.loadRepo('non-existent')).rejects.toThrow('Repository not found');
        });
        (0, vitest_1.it)('should load static format correctly', async () => {
            const repos = await dataLoader.listRepos();
            const staticRepo = repos.find(r => r.name.includes('static'));
            if (!staticRepo)
                throw new Error('Static test fixture not found');
            const data = await dataLoader.loadRepo(staticRepo.id);
            (0, vitest_1.expect)(data).toHaveProperty('repositoryPath');
            (0, vitest_1.expect)(data).toHaveProperty('commit');
            (0, vitest_1.expect)(data).toHaveProperty('tree');
            (0, vitest_1.expect)(data).toHaveProperty('stats');
        });
        (0, vitest_1.it)('should load timeline format correctly', async () => {
            const repos = await dataLoader.listRepos();
            const timelineRepo = repos.find(r => r.name.includes('timeline'));
            if (!timelineRepo)
                throw new Error('Timeline test fixture not found');
            const data = await dataLoader.loadRepo(timelineRepo.id);
            (0, vitest_1.expect)(data).toHaveProperty('format');
            (0, vitest_1.expect)(data).toHaveProperty('commits');
            (0, vitest_1.expect)(data).toHaveProperty('metadata');
            (0, vitest_1.expect)(data.format).toBe('timeline-v2');
        });
    });
    (0, vitest_1.describe)('findRepoByUrl', () => {
        (0, vitest_1.it)('should find repository by GitHub URL', async () => {
            const repo = await dataLoader.findRepoByUrl('https://github.com/test/ecommerce');
            (0, vitest_1.expect)(repo).toBeDefined();
            (0, vitest_1.expect)(repo?.id).toContain('ecommerce');
        });
        (0, vitest_1.it)('should handle URLs with .git suffix', async () => {
            const repo = await dataLoader.findRepoByUrl('https://github.com/test/ecommerce.git');
            (0, vitest_1.expect)(repo).toBeDefined();
            (0, vitest_1.expect)(repo?.id).toContain('ecommerce');
        });
        (0, vitest_1.it)('should return null for non-existent repository', async () => {
            const repo = await dataLoader.findRepoByUrl('https://github.com/test/nonexistent');
            (0, vitest_1.expect)(repo).toBeNull();
        });
        (0, vitest_1.it)('should return null for invalid URL', async () => {
            const repo = await dataLoader.findRepoByUrl('not-a-url');
            (0, vitest_1.expect)(repo).toBeNull();
        });
    });
});
