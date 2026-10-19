import BlogDocsPage from "../components/BlogDocsPage";

export default function TechnicalPage() {
  return (
    <BlogDocsPage
      docType="technical"
      heading="Dokumentasi teknikal"
      description="Catatan teknis bergaya blog — arsitektur, aturan, API. Tag aplikasi atau Others; dukung gambar. RAG search tetap tersedia."
      showRag
    />
  );
}
