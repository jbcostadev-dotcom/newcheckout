import { redirect } from "next/navigation";

export default function HomePage() {
  // If someone lands on the bare domain, redirect to a placeholder page
  // In production this shouldn't happen (Caddy only routes known subdomains/custom domains)
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a1a",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 20,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Checkout PRO
        </h1>
        <p style={{ fontSize: 14, opacity: 0.6 }}>
          Acesse sua loja através do subdomínio ou domínio personalizado.
        </p>
      </div>
    </div>
  );
}
