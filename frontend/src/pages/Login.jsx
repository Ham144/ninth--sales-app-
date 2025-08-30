import React, { useState } from "react";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { cn } from "@/lib/utils";
import { APP_NAME, NODE_ENV, siteKeyCloudflare } from "@/api/constant";
import { DotBackgroundDemo } from "@/components/ui/DotBackgroundDemo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loginApp, loginLdap } from "@/api/authApi";
import { toast } from "sonner";
import OrgApi from "@/api/orgApi";
import { useUserInfo } from "@/store";
import { useNavigate } from "react-router";
import TurnstileCaptcha from "@/components/TurnstileCaptcha";

export default function SignupFormDemo() {
  const [body, setBody] = useState({
    username: "",
    password: "",
  });
  const [selectedOrg, setSelectedOrg] = useState({
    organizationName: "CATUR SUKSES INTERNASIONAL",
    _id: "688828ded953f48ff0fa7cba",
  });
  const [captchaToken, setCaptchaToken] = useState("");

  const { setUserInfo } = useUserInfo();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("*");
  const { data: orgList } = useQuery({
    queryKey: ["org", search],
    queryFn: () => OrgApi.getAllOrg(search),
  });

  const { mutateAsync: handleLoginLdap, isPending: isLoginLdapPending } =
    useMutation({
      mutationFn: async () => {
        if (!captchaToken && NODE_ENV === "production") {
          toast.error("Harap pecahkan CAPTCHA terlebih dahulu.");
          return;
        }
        const res = await loginLdap({
          username: body.username,
          password: body.password,
          selectedOrg,
          captchaToken,
        });
        return res;
      },
      retryDelay: 1000,
      mutationKey: ["userInfo"],
      onSuccess: async (res) => {
        if (res?.twoFARequired && res?.pendingToken) {
          sessionStorage.setItem("pending2faToken", res.pendingToken);
          navigate("/2fa/verification");
          return;
        }

        if (res?.data) {
          setUserInfo(res.data);
          queryClient.invalidateQueries(["userInfo"]);
        }

        toast.success("Login berhasil!");
        navigate("/");
        setTimeout(() => {
          navigate("/");
        }, 1000);
      },
      onError: (err) => {
        if (err.response.status === 403) {
          //gagal turnstile
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
        toast.error(
          err?.response?.data?.message ||
            "Login gagal. Periksa username dan password Anda."
        );
      },
    });

  const { mutateAsync: handleLoginApp, isPending: isLoginAppPending } =
    useMutation({
      mutationFn: async () => {
        if (!captchaToken && NODE_ENV === "production") {
          toast.error("Harap pecahkan CAPTCHA terlebih dahulu.");
          return;
        }
        const res = await loginApp({
          username: body.username,
          password: body.password,
          selectedOrg,
          captchaToken,
        });
        return res;
      },
      retryDelay: 1000,
      mutationKey: ["userInfo"],
      onSuccess: async (res) => {
        if (res?.twoFARequired && res?.pendingToken) {
          sessionStorage.setItem("pending2faToken", res.pendingToken);
          navigate("/2fa/verification");
          return;
        }

        if (res?.data) {
          setUserInfo(res.data);
          queryClient.invalidateQueries(["userInfo"]);
        }

        toast.success("Login berhasil!");
        navigate("/");
        setTimeout(() => {
          navigate("/");
        }, 1000);
      },
      onError: (err) => {
        if (err.response.status === 403) {
          //gagal turnstile
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
        toast.error(
          err?.response?.data?.message ||
            "Login gagal. Periksa username dan password Anda."
        );
      },
    });

  return (
    <DotBackgroundDemo>
      <div className="shadow-input mx-auto w-full max-w-md rounded-none bg-white p-4 md:rounded-2xl md:p-8 dark:bg-black">
        <h2 className="text-xl font-bold text-center text-neutral-800 dark:text-neutral-200">
          Masuk ke {APP_NAME}
        </h2>
        <p className="mt-2  max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
          Masuk menggunakan akun Active Directory anda atau credential app yang
          diberikan dari organisasi anda
        </p>
        <div className="my-8 ">
          <div className="mb-4 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
            <LabelInputContainer>
              <Label htmlFor="firstname">username</Label>
              <Input
                onChange={(e) => setBody({ ...body, username: e.target.value })}
                id="firstname"
                placeholder="ham"
                type="text"
              />
            </LabelInputContainer>
          </div>
          <LabelInputContainer className="mb-4">
            <Label htmlFor="password">Password</Label>
            <Input
              onChange={(e) => setBody({ ...body, password: e.target.value })}
              id="password"
              placeholder="••••••••"
              type="password"
            />
          </LabelInputContainer>
          <div className="flex max-h-40 flex-col py-2 px-1 rounded-md">
            {orgList?.data?.length > 0 ? (
              <ul className="border border-gray-200 dark:border-gray-700 rounded-lg mt-2 overflow-y-auto max-h-40  divide-y divide-gray-200 dark:divide-gray-700 shadow-inner">
                {orgList?.data.map((org) => (
                  <li
                    key={org._id}
                    onClick={() => {
                      setSelectedOrg(org);
                      setSearch(org.organizationName);
                    }}
                    className={`p-3 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer transition-all duration-150 ${
                      selectedOrg?._id === org._id
                        ? "bg-blue-50 dark:bg-blue-800"
                        : ""
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {org.organizationName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ID: {org._id}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              search && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Organisasi Belum ada
                </p>
              )
            )}
          </div>

          {/* verify captcha  */}
          {NODE_ENV == "production" && (
            <div className="my-4 mx-auto justify-center items-center flex">
              <TurnstileCaptcha
                onVerify={(token) => {
                  if (!token) {
                    window.location.reload();
                  }
                  setCaptchaToken(token);
                }}
                siteKey={siteKeyCloudflare}
              />
            </div>
          )}

          <div className="my-8 h-[1px] w-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-neutral-700" />
          <div className="flex gap-x-3 items-center">
            <button
              onClick={() => handleLoginLdap()}
              disabled={isLoginLdapPending || isLoginAppPending}
              className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset]"
              type="button"
            >
              <span className="flex gap-x-2 justify-center items-center ">
                {isLoginLdapPending || isLoginAppPending ? (
                  <span className="loading loading-ring loading-lg"></span>
                ) : (
                  "Masuk (AD)"
                )}
                <BottomGradient />
              </span>
            </button>
            <button
              onClick={handleLoginApp}
              disabled={isLoginLdapPending || isLoginAppPending}
              className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] "
              type="button"
            >
              <span className="flex gap-x-2 justify-center items-center ">
                {isLoginLdapPending || isLoginAppPending ? (
                  <span className="loading loading-ring loading-lg"></span>
                ) : (
                  "Masuk (App)"
                )}
                <BottomGradient />
              </span>
            </button>
          </div>
        </div>
      </div>
    </DotBackgroundDemo>
  );
}

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({ children, className }) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};
