/**
 * Phase 3 — reusable optimistic mutation wrapper.
 *
 * Wraps useMutation with the standard optimistic-update lifecycle
 * (snapshot → apply → rollback on error → invalidate on settle) so every
 * consumer gets safe rollback without repeating the same code.
 *
 * The `mutationFn` is the server call. `optimistic` receives the current
 * cache snapshot and the variables and returns the next value for the
 * affected query key. `queryKey` is the *single* key to touch; if a
 * mutation crosses domains, invalidate additional keys via `extraKeys`.
 */
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

export function useOptimisticMutation<TData, TVars, TSnap = unknown>(opts: {
  mutationFn: (vars: TVars) => Promise<TData>;
  queryKey: QueryKey;
  optimistic: (prev: TSnap | undefined, vars: TVars) => TSnap;
  extraKeys?: QueryKey[];
  onError?: UseMutationOptions<TData, unknown, TVars>["onError"];
  onSuccess?: UseMutationOptions<TData, unknown, TVars>["onSuccess"];
}) {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVars, { prev: TSnap | undefined }>({
    mutationFn: opts.mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: opts.queryKey });
      const prev = qc.getQueryData<TSnap>(opts.queryKey);
      qc.setQueryData<TSnap>(opts.queryKey, opts.optimistic(prev, vars));
      return { prev };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(opts.queryKey, ctx.prev);
      opts.onError?.(err, vars, ctx);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: opts.queryKey });
      for (const k of opts.extraKeys ?? []) qc.invalidateQueries({ queryKey: k });
    },
    onSuccess: opts.onSuccess,
  });
}
