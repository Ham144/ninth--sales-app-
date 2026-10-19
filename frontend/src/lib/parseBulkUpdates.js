const LINE_REGEX = /^\[(x|cancel|fail)?\]\s*(.+?):\s*(.+)$/i;

function mapMarkerToStatus(marker) {
  if (!marker) return "pending";
  const lower = marker.toLowerCase();
  if (lower === "x") return "done";
  if (lower === "cancel") return "cancelled";
  if (lower === "fail") return "failed";
  return "pending";
}

export function parseBulkUpdates(text) {
  const lines = text.split(/\r?\n/);
  const parsed = [];
  const errors = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const lineNumber = index + 1;
    if (!line || line.startsWith("#")) return;

    const match = line.match(LINE_REGEX);
    if (!match) {
      errors.push({
        lineNumber,
        line: rawLine,
        message: "Format: [x|cancel|fail|] project: task",
      });
      return;
    }

    const [, marker, projectRaw, task] = match;
    parsed.push({
      status: mapMarkerToStatus(marker),
      projectRaw: projectRaw.trim(),
      task: task.trim(),
      lineNumber,
    });
  });

  return { parsed, errors };
}
