import axiosInstance from "@/api/axiosInstance";
import { useUserInfo } from "@/store";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "sonner";

const DeveloperPage = () => {
  const [newKeyName, setNewKeyName] = useState("");
  const [activeTab, setActiveTab] = useState("documentation");

  const { userInfo } = useUserInfo();

  const { data: apiKeys, isPending: pendingApiKeys } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/asThirdParty/integration/list");
      console.log(res);
      return res.data;
    },
    enabled: userInfo.username == "SUPERTENANT",
  });

  const { mutateAsync: handleGenerateApiKey } = useMutation({
    mutationKey: ["apiKeys"],
    mutationFn: async (projectName) => {
      const res = await axiosInstance.post(
        "/api/asThirdParty/generate/apiKey",
        { projectName }
      );
      return res.data;
    },
  });

  const [generatedKey, setGeneratedKey] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const generateNewKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      await handleGenerateApiKey(newKeyName);

      // Get the newly created API key to show in modal
      const res = await axiosInstance.get("/api/asThirdParty/integration/list");
      const newKey = res.data.data.find(
        (key) => key.projectName === newKeyName
      );

      if (newKey) {
        // Get the full API key (one-time view)
        const keyDetails = await axiosInstance.get(
          `/api/asThirdParty/getById/${newKey._id}`
        );
        setGeneratedKey(keyDetails.data.data.apiKey);
        setShowModal(true);
      }
    } catch (error) {
      // Handle error if needed
      toast.error(error?.response?.data?.message || "Failed to generate key");
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Developer Portal</h1>
          <p className="text-xl opacity-70">
            API Key Management and Documentation
          </p>
        </div>

        <div className="tabs tabs-boxed justify-center mb-8">
          <button
            className={`tab ${
              activeTab === "documentation" ? "tab-active" : ""
            }`}
            onClick={() => setActiveTab("documentation")}
          >
            Documentation
          </button>
          <button
            className={`tab ${activeTab === "keys" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("keys")}
          >
            API Keys
          </button>
        </div>

        {activeTab === "documentation" && (
          <div className="bg-base-100 rounded-box p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6">API Documentation</h2>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-3">Authentication</h3>
              <p className="mb-4">
                All API requests require authentication using your CSI
                Integration API key. Include the key in the{" "}
                <code className="bg-base-300 px-2 py-1 rounded">X-API-Key</code>{" "}
                header. Your API key format will be:{" "}
                <code className="bg-base-300 px-2 py-1 rounded">
                  CSIOPEN_xxxxxxxxxxxxxxxx
                </code>
              </p>
              <div className="bg-base-300 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap">
                  {`// Example authentication header
fetch('https://your-api-endpoint', {
  method: 'GET',
  headers: {
    'X-API-Key': 'CSIOPEN_xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json'
  }
})`}
                </pre>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-3">Customer Endpoints</h3>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-success badge-lg">GET</span>
                  <code className="font-mono">/api/customer/list</code>
                </div>
                <p className="ml-12">Search and paginate customers.</p>
                <div className="ml-12 mt-2 bg-base-300 p-3 rounded">
                  <pre className="text-sm whitespace-pre-wrap">{`// Query params
// searchKey (optional): string prefix of No/Name/Phone_No/HP_No
// skip (optional): number, default 0
// limit (optional): number, default 10
GET /api/customer/list?searchKey=ALF&skip=0&limit=10

// Response shape
{
  "data": [ { "_id": "...", "No": "C0001", "Name": "ALFA" } ],
  "total": 123,
  "totalPages": 13,
  "currentPage": 1,
  "message": "berhasil ambil data"
}`}</pre>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-primary badge-lg">POST</span>
                  <code className="font-mono">/api/customer/getByNo/:no</code>
                </div>
                <p className="ml-12">
                  Get detailed customer info and overdue payments.
                </p>
                <div className="ml-12 mt-2 bg-base-300 p-3 rounded">
                  <pre className="text-sm whitespace-pre-wrap">{`// Path param
// :no = customer number
POST /api/customer/getByNo/C0001

// Response shape
{
  "data": {
    "customer": { "No": "C0001", "Name": "ALFA", ... },
    "pembayaranTertunda": [ { "Due_Date": "2025-01-01", ... } ]
  },
  "message": "berhasil mengambil single data"
}`}</pre>
                </div>
              </div>

              <h3 className="text-xl font-semibold mb-3">Product Endpoints</h3>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-success badge-lg">GET</span>
                  <code className="font-mono">/api/product/list</code>
                </div>
                <p className="ml-12">
                  Search products with pagination and sorting.
                </p>
                <div className="ml-12 mt-2 bg-base-300 p-3 rounded">
                  <pre className="text-sm whitespace-pre-wrap">{`// Query params
// searchKey (optional)
// skip (optional)
// limit (optional)
GET /api/product/list?searchKey=LAPTOP&skip=0&limit=10

// Response shape
{
  "data": [ { "No": "P0001", "Description": "LAPTOP", ... } ],
  "total": 200,
  "totalPages": 20,
  "currentPage": 1,
  "message": "berhasil ambil data"
}`}</pre>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-info badge-lg">GET</span>
                  <code className="font-mono">
                    /api/product/getStock?No=ITEMNO
                  </code>
                </div>
                <p className="ml-12">
                  Fetch real-time stock via SOAP and persist numeric fields.
                </p>
                <div className="ml-12 mt-2 bg-base-300 p-3 rounded">
                  <pre className="text-sm whitespace-pre-wrap">{`// Query params
// No: product number
GET /api/product/getStock?No=P0001

// Response shape
{
  "message": "berhasil ambil data",
  "data": { "No": "P0001", "Inventory": 120, ... }
}`}</pre>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Important Notes</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>One-time View:</strong> When you generate a new API
                  key, you can only view the full key once. Make sure to copy it
                  immediately as it won't be visible again.
                </li>
                <li>
                  <strong>Expiration:</strong> API keys expire after 1 year.
                  You'll need to generate a new key before expiration.
                </li>
                <li>
                  <strong>Security:</strong> Keep your API keys secure and never
                  expose them in client-side code or public repositories.
                </li>
                <li>
                  <strong>Project Naming:</strong> Each API key must have a
                  unique project name for identification purposes.
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "keys" && (
          <div className="bg-base-100 rounded-box p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6">API Key Management</h2>

            <div className="mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-end mb-6">
                <div className="flex-grow">
                  <label className="label">
                    <span className="label-text">Project Name</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., My first project"
                    className="input input-bordered w-full"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={generateNewKey}>
                  Generate New Key
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {pendingApiKeys ? (
                <div className="flex justify-center items-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : apiKeys?.data?.length > 0 ? (
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>API Key</th>
                      <th>Created</th>
                      <th>Expired at</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.data.map((key) => (
                      <tr key={key._id}>
                        <td>{key.projectName}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{key.apiKey}</span>
                            {!key.seen && (
                              <button
                                className="btn btn-xs btn-ghost"
                                onClick={() => copyToClipboard(key.apiKey)}
                              >
                                📋
                              </button>
                            )}
                          </div>
                        </td>
                        <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                        <td>{new Date(key.expiredAt).toLocaleDateString()}</td>
                        <td>
                          <span
                            className={`badge ${
                              key.status === "active"
                                ? "badge-success"
                                : "badge-error"
                            }`}
                          >
                            {key.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-xs btn-error btn-outline"
                            onClick={async () => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this API key?"
                                )
                              ) {
                                try {
                                  await axiosInstance.delete(
                                    `/api/asThirdParty/delete/${key._id}`
                                  );
                                  window.location.reload();
                                } catch (error) {
                                  toast.error(
                                    "Failed to delete API key : ",
                                    JSON.stringify(error)
                                  );
                                }
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No API keys found. Generate your first API key above.</p>
                </div>
              )}
            </div>

            <div className="mt-8 bg-warning text-warning-content p-4 rounded-lg">
              <h4 className="font-bold mb-2">Important Security Notes</h4>
              <ul className="list-disc pl-5">
                <li>
                  Keep your API keys secure and never expose them in client-side
                  code
                </li>
                <li>Regenerate your API keys regularly</li>
                <li>Use different keys for different environments</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <dialog id="show" className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">API Key Generated Successfully!</h3>
          <p className="mb-4">
            <strong>Project Name:</strong> {newKeyName}
          </p>
          <p className="py-4">
            Your API key is:{" "}
            <code className="font-mono text-lg bg-slate-200 p-2 rounded-lg mt-2 flex  ">
              {generatedKey}
            </code>
          </p>
          <div role="alert" className="alert alert-warning">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              Warning: Anda hanya bisa melihat ini satu kali, jangan share api
              key ini, pastikan simpan ditempat yang sangat sangat aman
            </span>
          </div>
          <div className="modal-action">
            <button className="btn" onClick={() => setShowModal(false)}>
              Close
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default DeveloperPage;
