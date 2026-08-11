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
        <GetInventoryByLocation xmlns="urn:microsoft-dynamics-schemas/codeunit/WSNav">
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
          </SalesLine>`,
          ).join("")}
        </SalesHeader>
      </xML_Sales>
    </SalesMobileInsertCSI>
  </Body>
</Envelope>`;
};

export const requestSalesOrderAutoReleasedXml = ({
  DocumentNo,
  SellToCustNo,
  ShiptToCode = "",
  OrderDate = "",
  ExtDoc,
  RequestDeliveryDate,
  SalesLine,
  LocationCode,
  AreaCode,
  CustomerPriceGrp = "",
  SalespersonCode = "",
  SellToContact = "",
  SOAP_SALESORDER_AUTORELEASED_XMLNS,
  NoSeries,
}) => {
  return `
<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
  <Body>
    <SalesMobileInsertAuto xmlns="urn:microsoft-dynamics-schemas/codeunit/WSNav">
      <xML_Sales>
        <SalesHeader xmlns="${SOAP_SALESORDER_AUTORELEASED_XMLNS}">
          <DocumentNo>${DocumentNo}</DocumentNo>
          <SellToCustNo>${SellToCustNo}</SellToCustNo>
          <ShiptToCode>${ShiptToCode}</ShiptToCode>
          <OrderDate>${OrderDate}</OrderDate>
          <LocationCode>${LocationCode}</LocationCode>
          <Dim1>${AreaCode}</Dim1>
          <CustomerPriceGrp>${CustomerPriceGrp}</CustomerPriceGrp>
          <SalespersonCode>${SalespersonCode}</SalespersonCode>
          <SellToContact>${SellToContact}</SellToContact>
          <NoSeries>${NoSeries}</NoSeries>
          <ExtDoc>${ExtDoc || ""}</ExtDoc>
          <RequestDeliveryDate>${RequestDeliveryDate}</RequestDeliveryDate>
          ${SalesLine.map(
            ({
              DocumentNo,
              LineNo,
              ItemNo,
              Qty,
              UnitPrice = "",
              LineDiscountAmount = "",
              PromoCode = "",
            }) => `
          <SalesLine>
            <DocumentNo>${DocumentNo}</DocumentNo>
            <LineNo>${LineNo}</LineNo>
            <ItemNo>${ItemNo}</ItemNo>
            <Qty>${Qty}</Qty>
            <UnitPrice>${UnitPrice}</UnitPrice>
            <LineDiscountAmount>${LineDiscountAmount}</LineDiscountAmount>
            <PromoCode>${PromoCode}</PromoCode>
          </SalesLine>`,
          ).join("")}
        </SalesHeader>
      </xML_Sales>
    </SalesMobileInsertAuto>
  </Body>
</Envelope>`;
};

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

// lihat Organization.model.js untuk melihat perbedaan checkInventory dan stock
export const checkInventoryXML = (No, locationCode) => {
  return `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
    <Body>
        <GetInventoryOnlyByLocation xmlns="urn:microsoft-dynamics-schemas/codeunit/WSNav">
            <itemNo>${No}</itemNo>
            <locationCode>${locationCode}</locationCode>
            <inventory>0</inventory>
        </GetInventoryOnlyByLocation>
    </Body>
</Envelope>`;
};
