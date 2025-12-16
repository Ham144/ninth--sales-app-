import { Router } from "express";
import { fetchData } from "../utils/soap-util.js";
import xml2js from "xml2js";
import { checkStatusSONAVXml } from "../xml.js";
import UserRefrensi from "../models/User.model.js";
import redisService from "../utils/redisService.js";

const router = Router();

router.get("/statusNav", async (req, res) => {
  const { return_value } = req.query;

  if (!return_value) {
    return { error: true, message: "return_value harus diisi" };
  }

  const data = JSON.parse(await redisService.get(return_value));
  if (data) {
    return res.json({ message: "berhasil ambil data 3 jam lalu", data });
  }

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

    if (!rawXmlResponse) {
      console.log("Response kosong");
      return { error: true, message: "Response kosong" };
    }

    let parsed;
    try {
      parsed = await xml2js.parseStringPromise(rawXmlResponse, {
        explicitArray: false,
        trim: true,
        tagNameProcessors: [xml2js.processors.stripPrefix], // tetap dipakai
      });
    } catch (err) {
      console.error("Gagal parse XML:", err);
      return { error: true, message: "Gagal parse XML" };
    }

    // Ambil node utama NAV (ReadMultiple dua kali)
    const innerResult =
      parsed?.Envelope?.Body?.ReadMultiple_Result?.ReadMultiple_Result;

    if (!innerResult) {
      return res.status(200).json({
        message: "belum ada data di NAV",
        data: innerResult,
      });
    }

    // Ambil SOAPI — bisa berupa array atau object
    const body = Array.isArray(innerResult?.SOAPI)
      ? innerResult.SOAPI
      : innerResult?.SOAPI
      ? [innerResult.SOAPI]
      : [];

    if (!body?.length) {
      return res.json({
        data: [],
      });
    } else if (body?.length > 0) {
      await redisService.set(
        return_value,
        JSON.stringify(body),
        "EX",
        3 * 60 * 60
      ); // 3 hours

      return res.json({
        data: body,
      });
    }
  } catch (error) {
    console.log(error?.message);
    return res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
});

export default router;
