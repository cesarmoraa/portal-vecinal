export function StatusBadge({ value }) {
  const normalized = `${value ?? ""}`.toLowerCase();
  const className =
    normalized === "al día"
      ? "badge badge-green"
      : normalized === "adelantado"
        ? "badge badge-blue"
        : normalized === "parcial"
          ? "badge badge-yellow"
          : normalized === "sin firma"
            ? "badge badge-gray"
            : "badge badge-red";

  return <span className={className}>{value}</span>;
}

