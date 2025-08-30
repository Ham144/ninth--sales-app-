import { Router } from "express";
import { reinitilizingOverdueList } from "../utils/cron-overdue.js";
import OverDue from "../models/OverDue.model.js";
import Customer from "../models/Customer.model.js";

const router = Router();

router.get("/list", async (req, res) => {
  const { skip, limit, search, startDate, endDate } = req.query;

  let query = {};

  try {
    if (search) {
      const searchNum = Number(search);
      if (!isNaN(searchNum)) {
        query = {
          $or: [
            { customerNo: searchNum },
            { documentNo: { $regex: search, $options: "i" } },
            { salespersonCode: { $regex: search, $options: "i" } },
          ],
        };
      } else {
        query = {
          $or: [
            { documentNo: { $regex: search, $options: "i" } },
            { salespersonCode: { $regex: search, $options: "i" } },
          ],
        };
      }
    }

    if (startDate && endDate) {
      const startDatePoint = new Date(startDate).setHours(0, 0, 0, 0);
      const endDatePoint = new Date(endDate).setHours(23, 59, 59, 999);

      if (startDatePoint > endDatePoint) {
        return res.status(400).json({
          message: "Tanggal awal harus lebih kecil dari tanggal akhir",
        });
      }

      query.dueDate = {
        $gte: new Date(startDatePoint),
        $lte: new Date(endDatePoint),
      };
    }

    const total = await OverDue.countDocuments(query);
    let data = await OverDue.find(query)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean()
      .exec();

    //collect the customer info
    const customerNumbers = data.map((item) => item.customerNo);
    const customers = await Customer.find({
      No: {
        $in: customerNumbers,
      },
    })
      .lean()
      .exec();

    data = data.map((item) => {
      const customer = customers.find(
        (customer) =>
          customer.No === item.customerNo ||
          customer.No === String(item.customerNo) ||
          customer.No === Number(item.customerNo)
      );

      if (customer) {
        // Hapus field internal MongoDB yang tidak diinginkan
        const cleanCustomer = { ...customer };
        delete cleanCustomer.$__;
        delete cleanCustomer._doc;
        delete cleanCustomer.__v;

        return { ...item, ...cleanCustomer };
      }

      return item;
    });

    return res.json({
      message: "berhasil ambil data",
      data,
      total,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("/renewOverdue", async (req, res) => {
  try {
    reinitilizingOverdueList();
    return res.json({
      message: "berhasil Memeperbarui data",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Endpoint untuk mendapatkan bulan yang tersedia (terdapat overdue)
router.get("/availableMonths", async (req, res) => {
  try {
    const months = await OverDue.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$dueDate" },
            month: { $month: "$dueDate" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 },
      },
    ]);

    return res.json({
      message: "berhasil ambil bulan yang tersedia",
      data: months.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        count: item.count,
        label: `${item._id.month}/${item._id.year} (${item.count} data)`,
      })),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("/downloadCsv", async (req, res) => {
  const { selectedMonth, includeCustomerDetail } = req.body;

  if (!selectedMonth) {
    return res.status(400).json({
      message: "selectedMonth is required",
    });
  }

  let query = {};

  try {
    if (selectedMonth) {
      const from = new Date(selectedMonth);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);

      const to = new Date(from);
      to.setMonth(to.getMonth() + 1);
      to.setDate(0);
      to.setHours(23, 59, 59, 999);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      query.dueDate = {
        $gte: from,
        $lte: to,
      };

      console.log("Date range:", {
        from: from.toISOString(),
        to: to.toISOString(),
        now: now.toISOString(),
      });
    }

    // Cek range tanggal yang tersedia di database
    const dateRange = await OverDue.aggregate([
      {
        $group: {
          _id: null,
          minDate: { $min: "$dueDate" },
          maxDate: { $max: "$dueDate" },
        },
      },
    ]);

    const response = await OverDue.find(query);

    // Jika tidak ada data, return error
    if (response.length === 0) {
      return res.status(404).json({
        message: `Tidak ada data overdue untuk bulan ${new Date(
          selectedMonth
        ).toLocaleDateString("id-ID")}`,
        query: query,
        availableRange: dateRange[0],
      });
    }

    // Jika includeCustomerDetail = true, ambil data customer
    let customerData = {};
    if (includeCustomerDetail) {
      console.log("Fetching customer details...");
      const customerNumbers = [
        ...new Set(response.map((item) => item.customerNo)),
      ];

      const customers = await Customer.find({
        No: { $in: customerNumbers },
      })
        .lean()
        .exec();

      // Buat mapping untuk akses cepat
      customerData = customers.reduce((acc, customer) => {
        acc[customer.No] = customer;
        return acc;
      }, {});

      console.log("Customer data fetched:", Object.keys(customerData).length);
    }

    // Buat CSV
    const csvRows = [];
    let headers = [
      "customerNo",
      "postingDate",
      "dueDate",
      "documentNo",
      "salespersonCode",
      "remainingAmount",
      "AR",
      "blocked",
    ];

    // Tambahkan header customer detail jika diperlukan
    if (includeCustomerDetail) {
      headers = [
        ...headers,
        "customerName",
        "customerAddress",
        "customerCity",
        "customerPhone",
        "customerBalance",
        "customerCreditLimit",
      ];
    }

    csvRows.push(headers.join(","));

    response.forEach((item) => {
      let row = [
        item.customerNo,
        item.postingDate
          ? new Date(item.postingDate).toLocaleDateString("id-ID")
          : "",
        item.dueDate ? new Date(item.dueDate).toLocaleDateString("id-ID") : "",
        item.documentNo,
        item.salespersonCode,
        item.remainingAmount,
        item.AR,
        item.blocked,
      ];

      // Tambahkan customer detail jika diperlukan
      if (includeCustomerDetail) {
        const customer = customerData[item.customerNo];
        row = [
          ...row,
          customer?.Name || "",
          customer?.Address || "",
          customer?.City || "",
          customer?.Phone_No || "",
          customer?.Balance || "",
          customer?.Credit_Limit_LCY || "",
        ];
      }

      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    res.setHeader("Content-Type", "text/csv");

    const filename = includeCustomerDetail
      ? `overdue-with-customer-detail-${new Date(selectedMonth)
          .toISOString()
          .slice(0, 7)}.csv`
      : `overdue-${new Date(selectedMonth).toISOString().slice(0, 7)}.csv`;

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(csvContent);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
