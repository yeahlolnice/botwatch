// In-memory tracking for long-running crawler jobs triggered via the admin
// API. This is a single-process app (no clustering), so in-memory state is
// sufficient — it just needs to survive across the fire-and-forget request
// that kicks a job off and the later requests that poll its status.
//
// POST /api/crawler/run used to await the entire batch before responding,
// which could take several minutes and was tripping the reverse proxy's
// gateway timeout (visible to the admin as "run failed: HTTP 502") even
// when the crawl itself was working fine. Now the route starts the job,
// responds immediately, and the admin UI polls GET /api/crawler/status
// (which includes this tracker's state) until it finishes.

function createRunTracker() {
    let running = false;
    let startedAt = null;
    let finishedAt = null;
    let lastResult = null;
    let lastError = null;

    return {
        isRunning: () => running,
        start() {
            running = true;
            startedAt = new Date().toISOString();
            finishedAt = null;
            lastError = null;
        },
        finish(result) {
            running = false;
            finishedAt = new Date().toISOString();
            lastResult = result;
        },
        fail(error) {
            running = false;
            finishedAt = new Date().toISOString();
            lastError = String(error?.message || error);
        },
        getState() {
            return { running, startedAt, finishedAt, lastResult, lastError };
        },
    };
}

export const crawlRunTracker = createRunTracker();
export const sitemapRunTracker = createRunTracker();
