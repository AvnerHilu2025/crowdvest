export const ui = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 20px 60px",
  } as const,

  card: {
    background: "#fff",
    border: "1px solid #E6EEF7",
    borderRadius: 10,
    padding: 18,
  } as const,

  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    margin: 0,
  } as const,

  sectionRule: {
    height: 2,
    background: "#19B7D8",
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 2,
  } as const,

  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 18,
  } as const,

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
  } as const,

  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    padding: "7px 0",
    borderBottom: "1px solid #F0F4FA",
  } as const,

  rowLast: {
    borderBottom: "none",
  } as const,

  label: { color: "#5B6B7A" } as const,
  value: { fontWeight: 600, color: "#0B1F33" } as const,

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid transparent",
  } as const,

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  } as const,

  th: {
    textAlign: "left",
    fontWeight: 700,
    padding: "10px 10px",
    borderBottom: "2px solid #19B7D8",
    color: "#0B1F33",
  } as const,

  td: {
    padding: "10px 10px",
    borderBottom: "1px solid #EAF0F8",
    verticalAlign: "middle",
  } as const,

  link: {
    color: "#0AA6C6",
    textDecoration: "none",
    fontWeight: 600,
  } as const,
};
