import { createFileRoute } from "@tanstack/react-router";

// Redirect handled by the /parent layout.
export const Route = createFileRoute("/parent/")({ component: () => null });
