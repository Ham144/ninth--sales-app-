export const productXml = ({ SOAP_PRODUCT_XMLNS }) => {
  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
    <Body>
        <ReadMultiple xmlns="${SOAP_PRODUCT_XMLNS}">
            <filter>
                <Field>No</Field>
                <Criteria>*</Criteria>
            </filter>
            <bookmarkKey></bookmarkKey>
            <setSize>100000</setSize>
        </ReadMultiple>
    </Body>
</Envelope>`;
};

export const customerXml = ({ SOAP_CUSTOMER_XMLNS }) => {
  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
      <Body>
        <ReadMultiple xmlns="${SOAP_CUSTOMER_XMLNS}">
          <filter>
            <Field></Field>
            <Criteria></Criteria>
          </filter>
          <bookmarkKey></bookmarkKey>
          <setSize>100000</setSize>
        </ReadMultiple>
      </Body>
    </Envelope>`;
};

export const checkStockXML = (No, locationCode, SOAP_STOCK_XMLNS) => {
  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
    <Body>
        <GetInventoryByLocation xmlns="${SOAP_STOCK_XMLNS}">
            <itemNo>${No}</itemNo>
            <locationCode>${locationCode}</locationCode>
            <inventory>0</inventory>
        </GetInventoryByLocation>
    </Body>
</Envelope>`;
};

export const requestSalesOrderXml = ({
  DocumentNo,
  SellToCustNo,
  ExtDoc,
  RequestDeliveryDate,
  SalesLine,
  Keterangan,
  LocationCode,
  AreaCode,
  SOAP_TRANSACTION_XMLNS,
  NoSeries,
}) => {
  return `
<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <SalesMobileInsertCSI xmlns="urn:microsoft-dynamics-schemas/codeunit/WSNav">
      <xML_Sales>
        <SalesHeader xmlns="${SOAP_TRANSACTION_XMLNS}">
          <DocumentNo>${DocumentNo}</DocumentNo>
          <SellToCustNo>${SellToCustNo}</SellToCustNo>
          <ShiptToCode></ShiptToCode>
          <OrderDate></OrderDate>
          <LocationCode>${LocationCode}</LocationCode>
          <Dim1>${AreaCode}</Dim1>
          <CustomerPriceGrp></CustomerPriceGrp>
          <SalespersonCode></SalespersonCode>
          <SellToContact></SellToContact>
          <NoSeries>${NoSeries}</NoSeries>
          <ExtDoc>${ExtDoc || ""}</ExtDoc>
          <RequestDeliveryDate>${RequestDeliveryDate}</RequestDeliveryDate>
          <Keterangan>${Keterangan}</Keterangan>
          ${SalesLine.map(
            ({ DocumentNo, LineNo, ItemNo, Qty }) => `
          <SalesLine>
            <DocumentNo>${DocumentNo}</DocumentNo>
            <LineNo>${LineNo}</LineNo>
            <ItemNo>${ItemNo}</ItemNo>
            <Qty>${Qty}</Qty>
            <UnitPrice></UnitPrice>
            <LineDiscountAmount></LineDiscountAmount>
            <PromoCode></PromoCode>
          </SalesLine>`
          ).join("")}
        </SalesHeader>
      </xML_Sales>
    </SalesMobileInsertCSI>
  </Body>
</Envelope>`;
};

/*
              YG tidak ada maka tidak perlu diisi (opsional)
                    <DocumentNo> = is nama sales beserta increment dari backend
                    <SellToCustNo> = customer no
                    <ShiptToCode>[string]</ShiptToCode> //optional
                    <OrderDate>[string]</OrderDate> //optional
                    <LocationCode> = //Location_Code
                    <Dim1>[string]</Dim1> //optional
                    <CustomerPriceGrp> = customer.Customer_Price_Group
                    <SalespersonCode>[string]</SalespersonCode> //optional
                    <SellToContact>[string]</SellToContact> //optional
                    <NoSeries> = ?? 
                    <ExtDoc> //isi nomor invoice generate by backend
                    <RequestDeliveryDate> = contoh: 09/08/2025
                    <SalesLine>
                        <DocumentNo> sama dengan DocumentNo diatas
                        <LineNo> //1000 jika sales Line ada 2 maka yg kedua 2000
                        <ItemNo></ItemNo> //  sku
                        <Qty>[decimal]</Qty> //1
                        <UnitPrice>[decimal]</UnitPrice> //optional
                        <LineDiscountAmount>[decimal]</LineDiscountAmount> //optional
                        <PromoCode>[string]</PromoCode> //optional
                    </SalesLine>
*/

export const cekPembayaranTertundaXml = ({
  customerNo,
  SOAP_PEMBAYARANTERTUNDA_XMLNS,
}) => {
  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
<Body>
<ReadMultiple xmlns="${SOAP_PEMBAYARANTERTUNDA_XMLNS}">
<filter>
<Field>Customer_No</Field>
<Criteria>${customerNo}</Criteria>
</filter>
<bookmarkKey></bookmarkKey>
<setSize></setSize>
</ReadMultiple>
</Body>
</Envelope>`;
};

export const pembayaranTertundaFullXml = () => {
  return `
  <Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
<Body>
<ReadMultiple xmlns="urn:microsoft-dynamics-schemas/page/remainingsi">
<filter>
<Field>Customer_No</Field>
<Criteria>*</Criteria>
</filter>
<bookmarkKey></bookmarkKey>
<setSize></setSize>
</ReadMultiple>
</Body>
</Envelope>
  `;
};

export const checkStatusSONAVXml = ({ return_value, xmlns }) => {
  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
    <Body>
      <ReadMultiple xmlns="${
        xmlns || "urn:microsoft-dynamics-schemas/page/soapi"
      }">
        <filter>
          <Field>No</Field>
          <Criteria>${return_value}</Criteria>
        </filter>
        <bookmarkKey></bookmarkKey>
        <setSize></setSize>
      </ReadMultiple>
    </Body>
  </Envelope>`;
};
