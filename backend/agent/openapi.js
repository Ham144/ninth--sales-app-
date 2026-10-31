export const openApi = {
  openapi: "3.0.3",
  info: {
    title: "CSI Agent Chat",
    version: "0.1.0",
    description:
      "Chatbot internal & pengunjung e-commerce. x-api-key hanya untuk mint token di server. Browser memakai chat token.",
  },
  paths: {
    "/api/v1/agent/token": {
      post: {
        summary: "Mint chat token",
        parameters: [
          { name: "x-api-key", in: "header", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["visitorId"],
                properties: {
                  visitorId: { type: "string" },
                  customerId: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/agent/chat": {
      post: {
        summary: "Kirim pesan. stream true mengembalikan SSE.",
        security: [{ chatToken: [] }],
      },
    },
    "/api/v1/agent/sessions/{id}": { get: { summary: "Riwayat sesi milik visitor token" } },
    "/api/v1/agent/handoff": { post: { summary: "Eskalasi ke manusia" } },
  },
};
