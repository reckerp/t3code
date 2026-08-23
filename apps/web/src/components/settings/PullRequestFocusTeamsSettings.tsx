import {
  MAX_PULL_REQUEST_FOCUS_TEAM_MEMBERS,
  MAX_PULL_REQUEST_FOCUS_TEAMS,
  type PullRequestFocusTeam,
} from "@t3tools/contracts/settings";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { parsePullRequestFocusTeamMembers } from "../pullRequest/pullRequestList.logic";
import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

function createFocusTeamId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${slug.length > 0 ? slug : "team"}-${suffix}`;
}

function formatMembers(members: ReadonlyArray<string>): string {
  return members.join(", ");
}

export function PullRequestFocusTeamsSettingsSection() {
  const teams = useClientSettings((settings) => settings.pullRequestFocusTeams);
  const updateClientSettings = useUpdateClientSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMembers, setDraftMembers] = useState("");

  const resetDraft = () => {
    setEditingId(null);
    setDraftName("");
    setDraftMembers("");
  };

  const startCreate = () => {
    setEditingId("__new__");
    setDraftName("");
    setDraftMembers("");
  };

  const startEdit = (team: PullRequestFocusTeam) => {
    setEditingId(team.id);
    setDraftName(team.name);
    setDraftMembers(formatMembers(team.members));
  };

  const saveDraft = () => {
    const name = draftName.trim();
    const members = parsePullRequestFocusTeamMembers(draftMembers);
    if (name.length === 0 || members.length === 0) return;

    if (editingId === "__new__") {
      if (teams.length >= MAX_PULL_REQUEST_FOCUS_TEAMS) return;
      const nextTeam: PullRequestFocusTeam = {
        id: createFocusTeamId(name),
        name,
        members: [...members].slice(0, MAX_PULL_REQUEST_FOCUS_TEAM_MEMBERS),
      };
      updateClientSettings({ pullRequestFocusTeams: [...teams, nextTeam] });
      resetDraft();
      return;
    }

    if (editingId === null) return;
    updateClientSettings({
      pullRequestFocusTeams: teams.map((team) =>
        team.id === editingId
          ? {
              ...team,
              name,
              members: [...members].slice(0, MAX_PULL_REQUEST_FOCUS_TEAM_MEMBERS),
            }
          : team,
      ),
    });
    resetDraft();
  };

  const deleteTeam = (teamId: string) => {
    updateClientSettings({
      pullRequestFocusTeams: teams.filter((team) => team.id !== teamId),
    });
    if (editingId === teamId) resetDraft();
  };

  const draftMembersParsed = parsePullRequestFocusTeamMembers(draftMembers);
  const canSave =
    draftName.trim().length > 0 &&
    draftMembersParsed.length > 0 &&
    (editingId !== "__new__" || teams.length < MAX_PULL_REQUEST_FOCUS_TEAMS);

  return (
    <SettingsSection
      id={searchableSetting("pull-request-focus-teams").id}
      title="Pull request focus teams"
    >
      <SettingsRow
        title="Author groups"
        description="Named groups of GitHub usernames for narrowing the pull request list to people you follow."
      />
      {teams.length === 0 && editingId === null ? (
        <SettingsRow
          title="No focus teams yet"
          description="Create a team with GitHub usernames to filter open pull requests on the Pull requests page."
        />
      ) : (
        teams.map((team) =>
          editingId === team.id ? null : (
            <SettingsRow
              key={team.id}
              title={team.name}
              description={`${team.members.length} author${team.members.length === 1 ? "" : "s"}: ${formatMembers(team.members)}`}
              control={
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(team)}>
                    Edit
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${team.name}`}
                    onClick={() => deleteTeam(team.id)}
                  >
                    <Trash2Icon aria-hidden className="size-4" />
                  </Button>
                </div>
              }
            />
          ),
        )
      )}

      {editingId !== null ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
          <SettingsRow
            title={editingId === "__new__" ? "New focus team" : "Edit focus team"}
            description="Enter GitHub usernames separated by commas, spaces, or newlines."
          />
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="focus-team-name">
              Team name
            </label>
            <Input
              id="focus-team-name"
              value={draftName}
              onChange={(event) => setDraftName(event.currentTarget.value)}
              placeholder="Platform team"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="focus-team-members"
            >
              Authors
            </label>
            <Textarea
              id="focus-team-members"
              value={draftMembers}
              onChange={(event) => setDraftMembers(event.currentTarget.value)}
              placeholder="octocat, hubot"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {draftMembersParsed.length} author
              {draftMembersParsed.length === 1 ? "" : "s"}
              {draftMembersParsed.length > MAX_PULL_REQUEST_FOCUS_TEAM_MEMBERS
                ? ` (only the first ${MAX_PULL_REQUEST_FOCUS_TEAM_MEMBERS} are kept)`
                : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!canSave} onClick={saveDraft}>
              Save team
            </Button>
            <Button size="sm" variant="ghost" onClick={resetDraft}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-2">
          <Button
            size="sm"
            variant="outline"
            disabled={teams.length >= MAX_PULL_REQUEST_FOCUS_TEAMS}
            onClick={startCreate}
          >
            <PlusIcon aria-hidden className="size-4" />
            Add focus team
          </Button>
          {teams.length >= MAX_PULL_REQUEST_FOCUS_TEAMS ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Maximum of {MAX_PULL_REQUEST_FOCUS_TEAMS} focus teams reached.
            </p>
          ) : null}
        </div>
      )}

      {teams.length > 0 ? (
        <SettingsRow
          title="Using focus teams"
          description="On the Pull requests page, open the filter menu and choose a focus team under Authors."
        />
      ) : null}
    </SettingsSection>
  );
}
