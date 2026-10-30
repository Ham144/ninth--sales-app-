export default function AgentDocsPage() {
  return (
    <div>
      <header className="page-head">
        <h1>Integrasi chatbot</h1>
        <p>
          Programmer e-commerce memasang UI sendiri. Service ini yang menjawab. Spec mesin ada di{" "}
          <code>/api/v1/agent/openapi.json</code>.
        </p>
      </header>
      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Dua key, dua arah</h2>
        <ol>
          <li>
            Di halaman x-api-key, buat key scope <strong>Katalog publik</strong>. Key ini hanya
            untuk server e-commerce meminta chat token. Jangan taruh di browser.
          </li>
          <li>
            Browser pengunjung memakai chat token berumur pendek dari{" "}
            <code>POST /api/v1/agent/token</code>.
          </li>
        </ol>
        <pre className="code-block">{`POST /api/v1/agent/token
x-api-key: CSIOPEN_...
{ "visitorId": "anon-123" }

POST /api/v1/agent/chat
Authorization: Bearer <chatToken>
{ "message": "ada cat tembok?", "sessionId": null, "stream": true }`}</pre>
      </section>
      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Yang boleh dijawab</h2>
        <p>
          Katalog, ketersediaan kasar, dan dokumen how-to yang visibility-nya publik. Harga B2B,
          piutang, customer toko, dan dokumen teknikal tidak masuk ke model pada MVP ini.
        </p>
        <p>
          Kalau pengunjung minta orang, agent memanggil handoff. Isi webhook diatur IT lewat{" "}
          <code>PUT /api/v1/agent/admin/tenant</code>.
        </p>
      </section>
      <section className="panel">
        <h2>Widget minimum</h2>
        <pre className="code-block">{`const token = await mintFromYourBackend();
const res = await fetch(AGENT + "/api/v1/agent/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token.chatToken,
  },
  body: JSON.stringify({ message, sessionId, stream: true }),
});`}</pre>
      </section>
    </div>
  );
}