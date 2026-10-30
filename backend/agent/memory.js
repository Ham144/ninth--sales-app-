export function windowMessages(messages, size = 12) {
  const list = Array.isArray(messages) ? messages : [];
  const max = Math.max(1, size);
  if (list.length <= max) return list;
  let start = list.length - max;
  while (start > 0 && list[start].role === "tool") start -= 1;
  return list.slice(start);
}
