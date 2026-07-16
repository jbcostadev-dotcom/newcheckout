export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--checkout-bg)",
        color: "var(--text-primary)",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid var(--border-color)",
          borderTop: "3px solid var(--green-primary)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <p style={{ fontSize: "1rem", opacity: 0.7 }}>Carregando pagamento...</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
