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
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
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

export default router;
