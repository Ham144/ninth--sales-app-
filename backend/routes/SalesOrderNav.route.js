import { Router } from "express";
import { fetchData } from "../utils/soap-util.js";
import xml2js from "xml2js";
import { checkStatusSONAVXml } from "../xml.js";
import UserRefrensi from "../models/User.model.js";

const router = Router();

router.get("/statusNav", async (req, res) => {
  const { return_value } = req.query;

  try {
    const requestor = await UserRefrensi.findById(req.user._id).populate("org");
    if (!requestor) {
      return { error: true, message: "Requestor tidak ditemukan" };
    }

    const {
      SOAP_CHECKSTATUSNAV_URL,
      SOAP_CHECKSTATUSNAV_USERNAME,
      SOAP_CHECKSTATUSNAV_PASSWORD,
      SOAP_CHECKSTATUSNAV_SOAPACTION,
      SOAP_CHECKSTATUSNAV_XMLNS,
    } = requestor.org;

    if (
      !SOAP_CHECKSTATUSNAV_URL ||
      !SOAP_CHECKSTATUSNAV_USERNAME ||
      !SOAP_CHECKSTATUSNAV_PASSWORD ||
      !SOAP_CHECKSTATUSNAV_SOAPACTION ||
      !SOAP_CHECKSTATUSNAV_XMLNS
    ) {
      console.log("konfigurasi SOAP CHECKSTATUSNAV tidak lengkap");
      return null;
    }

    const xml = checkStatusSONAVXml({
      return_value,
      xmlns: SOAP_CHECKSTATUSNAV_XMLNS,
    });

    const rawXmlResponse = await fetchData({
      xml: xml,
      username: SOAP_CHECKSTATUSNAV_USERNAME,
      password: SOAP_CHECKSTATUSNAV_PASSWORD,
      url: SOAP_CHECKSTATUSNAV_URL,
      SOAPAction: SOAP_CHECKSTATUSNAV_SOAPACTION,
    });

    console.log(rawXmlResponse);

    if (!rawXmlResponse) {
      console.log("Response kosong");
      return { error: true, message: "Response kosong" };
    }

    let parsed;
    try {
      parsed = await xml2js.parseStringPromise(rawXmlResponse, {
        explicitArray: false,
        trim: true,
        tagNameProcessors: [xml2js.processors.stripPrefix],
      });
    } catch (err) {
      console.error("Gagal parse XML:", err);
      return { error: true, message: "Gagal parse XML" };
    }

    // 🔹 Cek kalau respons berisi error SOAP
    const fault = parsed?.Envelope?.Body?.Fault;
    if (fault) {
      return {
        error: true,
        code: fault?.faultcode || null,
        message: fault?.faultstring || "SOAP Fault tanpa pesan",
      };
    }

    // 🔹 Ambil node utama secara dinamis
    const body = parsed?.Envelope?.ReadMultiple_Result;

    if (!body) {
      return res.json({
        data: {
          statusNAV: "Belum ada data",
        },
      });
    }

    return res.json({
      body,
    });
  } catch (error) {
    console.log(error?.message);
    return res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
});

export default router;
