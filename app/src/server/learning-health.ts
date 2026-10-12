export const learningTargets = {
  app: "https://app.multicloud.polarisenterprisesv.com",
  aws: "https://aws.multicloud.polarisenterprisesv.com",
  gcp: "https://gcp.multicloud.polarisenterprisesv.com",
} as const;
export async function probeLearningHealth(fetcher: typeof fetch = fetch) {
  return Promise.all(
    Object.entries(learningTargets).map(async ([endpoint, origin]) => {
      const start = performance.now();
      try {
        const response = await fetcher(`${origin}/api/health/ready`, {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        const body = response.ok ? await response.json() : null;
        const site =
          body?.site === "aws" || body?.site === "gcp"
            ? (body.site as string)
            : null;
        return {
          endpoint,
          origin,
          httpStatus: response.status,
          site,
          ready:
            response.ok &&
            body?.status === "ready" &&
            site !== null &&
            (endpoint === "app" || site === endpoint),
          elapsedMs: Math.round(performance.now() - start),
        };
      } catch {
        return {
          endpoint,
          origin,
          httpStatus: 0,
          site: null,
          ready: false,
          elapsedMs: Math.round(performance.now() - start),
        };
      }
    }),
  );
}
