interface Props {
  view: string;
  sinceVersion: string;
}

export function DisabledView({ view, sinceVersion }: Props) {
  return (
    <div className="empty" style={{ flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 14, color: "var(--text)" }}>{view}</div>
      <div>Ships in {sinceVersion}</div>
    </div>
  );
}
