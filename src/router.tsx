import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Global cache defaults: reuse fetched data between navigations so
  // revisiting a page feels instant, and avoid refetch storms on tab focus.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 60s — no refetch on remount/nav within that window.
        staleTime: 60 * 1000,
        // Keep unused data in memory for 10 min so back-navigation is instant.
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Query owns freshness; router preload is a no-op cache.
    defaultPreloadStaleTime: 0,
    // Prefetch route code (and any loader data) on link hover / focus.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
  });

  return router;
};
