import { createFileRoute, Navigate } from "@tanstack/react-router";

// /inbox/templates is a sidebar shortcut to the message-templates manager,
// which lives under Settings → Templates.
export const Route = createFileRoute("/inbox/templates")({
  component: () => <Navigate to="/settings/templates" replace />,
});
