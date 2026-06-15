import nodemailer from "nodemailer";
import Org from "../models/Organization.model.js";

/**
 * Sends an email notification.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} html - The HTML body of the email.
 * @param {object} flowInstance - The flow instance document to get org context.
 */
async function sendEmail(to, subject, html, flowInstance) {
  try {
    const org = await Org.findById(flowInstance.org);
    if (!org) {
      console.error(
        "Organization not found for flow instance:",
        flowInstance._id
      );
      return;
    }

    const transportOptions = {
      host: org.EMAIL_HOST,
      port: org.EMAIL_PORT,
      secure: org.EMAIL_SECURE,
      auth: {
        user: org.EMAIL_USER,
        pass: org.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      family: 4,
    };

    const transporter = nodemailer.createTransport(transportOptions);

    const mailOptions = {
      from: org.EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    // We don't re-throw the error to avoid blocking the main API flow.
  }
}

/**
 * Generates and sends an approval request email to the next approvers.
 * @param {Array<{email: string, username: string}>} nextApprovers - An array of user objects for the next step.
 * @param {object} flowInstance - The flow instance document.
 * @param {string} previousApproverName - The name of the user who just completed the previous step.
 */
export async function sendApprovalRequestEmail(
  nextApprovers,
  flowInstance,
  previousApproverName
) {
  const instanceId = flowInstance._id;
  const instanceTitle = flowInstance.instanceTitle;
  const currentStatus =
    flowInstance.statuses[flowInstance.currentStatusIndex].statusTitle;

  const subject = `Approval Required: ${instanceTitle}`;

  for (const user of nextApprovers) {
    const approveLink = `${process.env.FRONTEND}/status/fulfillment/${instanceId}?action=approve`;
    const rejectLink = `${process.env.FRONTEND}/status/fulfillment/${instanceId}?action=reject`;
    const detailLink = `${process.env.FRONTEND}/status/fulfillment/${instanceId}`;

    const html = `
      <div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">
        <h2>📝 Permintaan Approval</h2>
        <p>Halo <strong>${user.username}</strong>,</p>
  
        <p>
          Anda mendapatkan tugas untuk melakukan approval pada permintaan <strong>${instanceTitle}</strong>.
        </p>
  
        <p>
          Permintaan ini sebelumnya telah diproses oleh <strong>${previousApproverName}</strong> dan saat ini berada di tahap status <strong>${currentStatus}</strong>.
        </p>
  
        <p>
          Mohon klik tombol berikut untuk meninjau dan memproses permintaan:
        </p>
  
        <div style="margin: 20px 0;">
          <a href="${detailLink}" style="display: inline-block; padding: 10px 15px; background-color: #0d6efd; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            🔍 Lihat Detail
          </a>
          <br/><br/>
          <a href="${approveLink}" style="display: inline-block; padding: 10px 15px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            ✅ Approve
          </a>
          <a href="${rejectLink}" style="display: inline-block; padding: 10px 15px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-left: 10px;">
            ❌ Reject
          </a>
        </div>
  
        <p>
          <strong>Catatan:</strong><br/>
          Tombol <strong>Approve</strong> akan langsung menyetujui permintaan ini jika Anda tidak memiliki requirement (form input) wajib yang perlu diisi.<br/>
          Tombol <strong>Reject</strong> tidak akan langsung menolak, Anda akan diarahkan ke halaman konfirmasi untuk mengisi alasan penolakan karena itu diperlukan.<br/>
          Gunakan tombol <strong>Lihat Detail</strong> untuk melihat informasi lengkap dan mengambil keputusan dari halaman sistem kita.
        </p>
  
        <p>Terima kasih atas kerjasama Anda.</p>
        <p>— CSI</p>
      </div>
    `;

    await sendEmail(user.email, subject, html, flowInstance);
  }
}

/**
 * Generates and sends a notification to users who were skipped in an approval step.
 * @param {Array<{email: string, username: string}>} skippedUsers - An array of user objects who were skipped.
 * @param {object} flowInstance - The flow instance document.
 * @param {string} approverName - The name of the user who completed the action.
 */
export async function sendSkippedUserNotification(
  skippedUsers,
  flowInstance,
  approverName,
  instanceId
) {
  const instanceTitle = flowInstance.instanceTitle;
  const completedStatus =
    flowInstance.statuses[flowInstance.currentStatusIndex - 1].statusTitle; // The status that was just completed

  const subject = `Update: Giliran diambil alih pada : ${instanceTitle}`;

  for (const user of skippedUsers) {
    const instanceLink = `${process.env.FRONTEND}/status/isOnlyPreview/${instanceId}`;
    const html = `
      <h1>Process Update</h1>
      <p>Halo ${user.username},</p>
      <p>Ini adalah notifikasi bahwa tindakan telah diambil terhadap request: <strong>${instanceTitle}</strong>.</p>
      <p>Tahap <strong>${completedStatus}</strong>, yang Anda diotorisasi untuk bertindak, telah diselesaikan oleh <strong>${approverName}</strong>.</p>
      <p>Tidak ada tindakan yang diperlukan dari Anda untuk langkah ini, ini hanya sebagai informasi. Anda dapat melihat status saat ini dari request di sini:</p>
      <a href="${instanceLink}">Lihat request</a>
      <br/>
      <p>Terimakasih - CSI.</p>
    `;
    await sendEmail(user.email, subject, html, flowInstance);
  }
}

// export async function askRollbackToRequester(
//   requester,
//   flowInstance,
//   approverName,
//   instanceId
// ) {
//   const instanceTitle = flowInstance.instanceTitle;
//   const completedStatus =
//     flowInstance.statuses[flowInstance.currentStatusIndex - 1].statusTitle; // The status that was just completed

//   const subject = `Update: Giliran diambil alih pada : ${instanceTitle}`;

//   const instanceLink = `${process.env.FRONTEND}/status/isOnlyPreview/${instanceId}`;
//   const html = `
//       <h1>Rollback Request oleh approval</h1>
//       <p>Halo ${user.username},</p>
//       <p>salah seorang approval meminta anda untuk melakukan rallback agar request dapat dimulai lagi dari awal, : <strong>${instanceTitle}</strong>.</p>
//       <p>Tahap <strong>${completedStatus}</strong>, yang Anda diotorisasi untuk bertindak, telah diselesaikan oleh <strong>${approverName}</strong>.</p>
//       <p>Tidak ada tindakan yang diperlukan dari Anda untuk langkah ini, ini hanya sebagai informasi. Anda dapat melihat status saat ini dari request di sini:</p>
//       <a href="${instanceLink}">Lihat request</a>
//       <br/>
//       <p>Terimakasih - CSI.</p>
//     `;
//   await sendEmail(user.email, subject, html);
// }
