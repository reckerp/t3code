import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { CircleIcon } from "lucide-react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { PullRequestFiltersMenu, pullRequestProjectKey } from "./PullRequestListFilters";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (!isValidElement(node)) return "";
  return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function findValueChange(
  node: ReactNode,
):
  | ReactElement<{ readonly children?: ReactNode; readonly onValueChange: (value: string) => void }>
  | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const props = child.props as {
      readonly children?: ReactNode;
      readonly onValueChange?: (value: string) => void;
    };
    if (props.onValueChange) {
      return child as ReactElement<{
        readonly children?: ReactNode;
        readonly onValueChange: (value: string) => void;
      }>;
    }
    const nested = findValueChange(props.children);
    if (nested) return nested;
  }
  return undefined;
}

/** The MenuRadioGroup whose MenuGroupLabel matches, for groups that are not PullRequestFilterRadioGroup. */
function findMenuRadioGroupByGroupLabel(
  node: ReactNode,
  groupLabel: string,
):
  | ReactElement<{ readonly children?: ReactNode; readonly onValueChange: (value: string) => void }>
  | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const props = child.props as {
      readonly children?: ReactNode;
      readonly onValueChange?: (value: string) => void;
    };
    const labels = textOf(props.children);
    if (props.onValueChange && labels.includes(groupLabel)) {
      return child as ReactElement<{
        readonly children?: ReactNode;
        readonly onValueChange: (value: string) => void;
      }>;
    }
    const nested = findMenuRadioGroupByGroupLabel(props.children, groupLabel);
    if (nested) return nested;
  }
  return undefined;
}

/** The nested radio-group component element carrying this label, invoked so its group shows. */
function findLabeledGroup(node: ReactNode, label: string): ReactNode {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const props = child.props as { readonly children?: ReactNode; readonly label?: string };
    if (props.label === label && typeof child.type === "function") {
      return (child.type as (properties: unknown) => ReactNode)(child.props);
    }
    const nested = findLabeledGroup(props.children, label);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function menu(overrides: Partial<Parameters<typeof PullRequestFiltersMenu>[0]>) {
  return PullRequestFiltersMenu({
    state: "open",
    stateOptions: [
      { value: "open", label: "Open", Icon: CircleIcon },
      { value: "closed", label: "Closed", Icon: CircleIcon },
    ],
    onState: () => undefined,
    involvement: "all",
    involvementOptions: [{ value: "all", label: "All", Icon: CircleIcon }],
    onInvolvement: () => undefined,
    filters: {},
    onFilters: () => undefined,
    host: undefined,
    hostOptions: [],
    onHost: () => undefined,
    server: undefined,
    serverOptions: [],
    onServer: () => undefined,
    projects: [],
    projectId: undefined,
    projectEnvironmentId: undefined,
    unavailable: new Map(),
    onProject: () => undefined,
    focusTeams: [],
    focusTeamId: undefined,
    onFocusTeam: () => undefined,
    ...overrides,
  });
}

describe("pull request filters menu", () => {
  it("always offers the Authors group, even with no saved focus teams", () => {
    const rendered = textOf(menu({ focusTeams: [] }));
    expect(rendered).toContain("Authors");
    expect(rendered).toContain("All authors");
    expect(rendered).toContain("Me");
  });

  it("does not emit a change when the selected state is chosen again", () => {
    const onState = vi.fn();
    const group = findValueChange(findLabeledGroup(menu({ onState }), "State"));
    expect(group).toBeDefined();

    group?.props.onValueChange("open");
    expect(onState).not.toHaveBeenCalled();

    group?.props.onValueChange("closed");
    expect(onState).toHaveBeenCalledOnce();
    expect(onState).toHaveBeenCalledWith("closed");
  });

  it("names the chosen narrowing and leaves the others alone", () => {
    const onFilters = vi.fn();
    const group = findValueChange(
      findLabeledGroup(menu({ filters: { review: "approved" }, onFilters }), "Draft"),
    );
    expect(group).toBeDefined();

    group?.props.onValueChange("hide");
    expect(onFilters).toHaveBeenCalledWith({ review: "approved", draft: "hide" });
  });

  it("drops a narrowing chosen back to all rather than sending it as undefined", () => {
    const onFilters = vi.fn();
    const group = findValueChange(
      findLabeledGroup(
        menu({ filters: { review: "none", checks: "failing" }, onFilters }),
        "Review",
      ),
    );
    expect(group).toBeDefined();

    group?.props.onValueChange("all");
    expect(onFilters).toHaveBeenCalledWith({ checks: "failing" });
  });

  it("does not emit a change when the selected project is chosen again", () => {
    const projectId = "project-1" as ProjectId;
    const environmentId = "env-1" as EnvironmentId;
    const onProject = vi.fn();
    const view = menu({
      projects: [
        {
          id: projectId,
          environmentId,
          title: "T3 Code",
          workspaceRoot: "/work/t3code",
        },
      ],
      projectId,
      projectEnvironmentId: environmentId,
      onProject,
    });
    const radioGroup = findMenuRadioGroupByGroupLabel(view, "Project");
    expect(radioGroup).toBeDefined();

    radioGroup?.props.onValueChange(pullRequestProjectKey({ id: projectId, environmentId }));
    expect(onProject).not.toHaveBeenCalled();

    radioGroup?.props.onValueChange("all");
    expect(onProject).toHaveBeenCalledWith(undefined, undefined);
  });

  it("passes the environment along so a duplicate project id on another server is told apart", () => {
    const projectId = "project-1" as ProjectId;
    const onProject = vi.fn();
    const view = menu({
      projects: [
        {
          id: projectId,
          environmentId: "env-1" as EnvironmentId,
          title: "T3 Code · one",
          workspaceRoot: "/work/t3code-1",
        },
        {
          id: projectId,
          environmentId: "env-2" as EnvironmentId,
          title: "T3 Code · two",
          workspaceRoot: "/work/t3code-2",
        },
      ],
      onProject,
    });
    const radioGroup = findMenuRadioGroupByGroupLabel(view, "Project");
    expect(radioGroup).toBeDefined();

    radioGroup?.props.onValueChange(
      pullRequestProjectKey({ id: projectId, environmentId: "env-2" as EnvironmentId }),
    );
    expect(onProject).toHaveBeenCalledWith(projectId, "env-2");
  });

  it("does not collide when environment and project ids contain spaces", () => {
    expect(
      pullRequestProjectKey({
        environmentId: "a b" as EnvironmentId,
        id: "c" as ProjectId,
      }),
    ).not.toBe(
      pullRequestProjectKey({
        environmentId: "a" as EnvironmentId,
        id: "b c" as ProjectId,
      }),
    );
  });
});
