import { Router } from "express";
import { fetchData } from "../utils/soap-util.js";
import xml2js from "xml2js";
import { checkStatusSONAVXml } from "../xml.js";
import redisService from "../utils/redisService.js";
import { loadRequestOrganization } from "../utils/resolveRequestOrg.js";
import {
  getMissingConfigFields,
  SOAP_CHECKSTATUSNAV_CONFIG_FIELDS,
} from "../utils/orgConfigFields.js";

const router = Router();

router.get("/statusNav", async (req, res) => {
  const { return_value } = req.query;

  try {
    if (!return_value) {
      return res.status(400).json({
        error: true,
        message: "return_value harus diisi",
      });
    }

    try {
      const cached = await redisService.get(return_value);
      if (cached) {
        const data = JSON.parse(cached);
        if (data) {
          return res.json({
            message: "berhasil ambil data 3 jam lalu",
            data,
          });
        }
      }
    } catch {
      // cache miss atau data cache invalid, lanjut hit NAV
    }

    const { org, orgId, source } = await loadRequestOrganization(req);

    if (!org) {
      return res.status(404).json({
        error: true,
        message: "Organisasi tidak ditemukan",
        orgId,
        source,
      });
    }

    const missingFields = getMissingConfigFields(
      org,
      SOAP_CHECKSTATUSNAV_CONFIG_FIELDS,
    );

    if (missingFields.length) {
      return res.status(500).json({
        error: true,
        message: "Konfigurasi SOAP CHECKSTATUSNAV tidak lengkap",
        orgId,
        organizationName: org.organizationName || null,
        source,
        missingFields,
      });
    }

    const {
      SOAP_CHECKSTATUSNAV_URL,
      SOAP_CHECKSTATUSNAV_USERNAME,
      SOAP_CHECKSTATUSNAV_PASSWORD,
      SOAP_CHECKSTATUSNAV_SOAPACTION,
      SOAP_CHECKSTATUSNAV_XMLNS,
    } = org;

    const xml = checkStatusSONAVXml({
      return_value,
      xmlns: SOAP_CHECKSTATUSNAV_XMLNS,
    });

    const rawXmlResponse = await fetchData({
      xml,
      username: SOAP_CHECKSTATUSNAV_USERNAME,
      password: SOAP_CHECKSTATUSNAV_PASSWORD,
      url: SOAP_CHECKSTATUSNAV_URL,
      SOAPAction: SOAP_CHECKSTATUSNAV_SOAPACTION,
    });

    if (!rawXmlResponse) {
      return res.status(502).json({
        error: true,
        message: "Response kosong dari NAV",
      });
    }

    let parsed;
    try {
      parsed = await xml2js.parseStringPromise(rawXmlResponse, {
        explicitArray: false,
        trim: true,
        tagNameProcessors: [xml2js.processors.stripPrefix],
      });
    } catch (err) {
      return res.status(502).json({
        error: true,
        message: `Gagal parse XML response: ${err?.message || err}`,
      });
    }

    const fault = parsed?.Envelope?.Body?.Fault;
    if (fault) {
      return res.status(502).json({
        error: true,
        code: fault?.faultcode || null,
        message: fault?.faultstring || "SOAP Fault tanpa pesan",
      });
    }

    const innerResult =
      parsed?.Envelope?.Body?.ReadMultiple_Result?.ReadMultiple_Result;

    if (!innerResult) {
      return res.status(200).json({
        message: "belum ada data di NAV",
        data: null,
      });
    }

    const body = Array.isArray(innerResult?.SOAPI)
      ? innerResult.SOAPI
      : innerResult?.SOAPI
        ? [innerResult.SOAPI]
        : [];

    if (!body.length) {
      return res.json({ data: [] });
    }

    await redisService.set(
      return_value,
      JSON.stringify(body),
      "EX",
      3 * 60 * 60,
    );

    return res.json({ data: body });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: error?.message || "Internal server error",
    });
  }
});

export default router;
