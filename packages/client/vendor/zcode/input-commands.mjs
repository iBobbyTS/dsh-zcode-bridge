/*! Derived from ZCode @29628c9acdb81b703bbd4080c207a0e7ce5e276e; Copyright 2026 Z.AI Co., Ltd. Apache-2.0 (LICENSE). Modified: selective ESM parser, TypeScript erased; see SOURCES.json. */

// ../reference/ZCode/packages/ui/src/v4/slashCommands.ts
function parseV4VisibleSlashCommand(content, attachments = [], options = {}) {
  const displayText = content.trim();
  if (!displayText.startsWith("/")) return null;
  const match = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(displayText);
  if (!match) return null;
  const commandName = match[1]?.toLowerCase() ?? "";
  const args = match[2]?.trim() ?? "";
  if (commandName === "plan") {
    const hasUnsupportedPayload = attachments.length > 0 || (options.contextAttachmentCount ?? 0) > 0;
    return {
      kind: hasUnsupportedPayload ? "unsupportedPlanShortcut" : "planShortcut",
      task: args,
      displayText
    };
  }
  if (attachments.length > 0 || (options.contextAttachmentCount ?? 0) > 0) {
    return null;
  }
  if (commandName === "compact" || commandName === "compress") {
    return { kind: "compact", displayText };
  }
  if (commandName !== "goal" && commandName !== "target") {
    return null;
  }
  if (!args) return { kind: "emptyGoal", displayText };
  const action = args.split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  if (action === "resume") return { kind: "resumeGoal", displayText };
  if (action === "pause" || action === "clear" || action === "show") {
    return { kind: "unsupportedGoal", action, displayText };
  }
  const objective = action === "replace" ? args.replace(/^replace\s*/i, "").trim() : args;
  if (!objective) return { kind: "emptyGoal", displayText };
  return { kind: "sendGoalCommand", objective, displayText };
}
export {
  parseV4VisibleSlashCommand
};
