// Centralized route constants — update paths here when renaming routes.
import { linkOptions } from "@tanstack/react-router";

export const ROUTES = {
  AI_CENTER: "/automation/agents",
  CALL_LOGS: "/automation/call-logs",
  WORKFLOWS: "/automation/workflows",
  TRIGGERS: "/automation/triggers",
} as const;

/** Type-safe link options for the workflow detail page. */
export const workflowDetailLink = (workflowId: string) =>
  linkOptions({
    to: "/automation/workflows/$workflowId",
    params: { workflowId },
  });