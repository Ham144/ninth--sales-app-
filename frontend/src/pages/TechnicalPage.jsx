import BlogDocsPage from "../components/BlogDocsPage";

export default function TechnicalPage() {
  return (
    <BlogDocsPage
      docType="technical"
      heading="Dokumentasi teknikal"
      description="Catatan teknis. Jatuhkan PDF untuk membuat draf, periksa aplikasi dan visibility, lalu simpan."
      showRag
    />
  );
}
