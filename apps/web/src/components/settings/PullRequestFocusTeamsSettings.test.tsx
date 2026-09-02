import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { PullRequestFocusTeamsSettingsSection } from "./PullRequestFocusTeamsSettings";

vi.mock("../../hooks/useSettings", () => ({
  useClientSettings: (selector: (settings: { pullRequestFocusTeams: [] }) => unknown) =>
    selector({ pullRequestFocusTeams: [] }),
  useUpdateClientSettings: () => vi.fn(),
  usePrimarySettingsAvailable: () => true,
}));

describe("PullRequestFocusTeamsSettingsSection", () => {
  it("mentions that focus teams filter loaded pull requests only", () => {
    const markup = renderToStaticMarkup(<PullRequestFocusTeamsSettingsSection />);
    expect(markup).toContain("Pull request focus teams");
    expect(markup).toContain("does not change how many are fetched initially");
  });
});
