import React from "react";
import { APP_DESC, APP_NAME } from "@/api/constant";
import { useUserInfo } from "@/store";
import { useQuery } from "@tanstack/react-query";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  History,
  Package,
  User2,
  ShieldCheck,
  Building2,
} from "lucide-react";
import GridItem from "@/components/ui/GridItem";

const Home = () => {
  const navigate = useNavigate();
  const { userInfo } = useUserInfo();

  return (
    <BackgroundBeamsWithCollision className={"flex flex-col py-20 "}>
      <h2 className="text-2xl relative z-20 md:text-4xl lg:text-7xl font-bold text-center text-black dark:text-white font-sans tracking-tight">
        <div className="relative mx-auto inline-block w-max [filter:drop-shadow(0px_1px_3px_rgba(27,_37,_80,_0.14))]">
          <div className="absolute left-0 top-[1px] bg-clip-text bg-no-repeat text-transparent bg-gradient-to-r py-4 from-purple-500 via-violet-500 to-pink-500 [text-shadow:0_0_rgba(0,0,0,0.1)]">
            <span className="">{APP_NAME}.</span>
          </div>
          <div className="relative bg-clip-text text-transparent bg-no-repeat bg-gradient-to-r from-purple-500 via-violet-500 to-pink-500 py-4">
            <span className="">{APP_NAME}.</span>
          </div>
        </div>
      </h2>

      <div className="relative h-full">
        <ul className="md:grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3 lg:gap-4 xl:max-h-[34rem] xl:grid-rows-2 overflow-y-auto pb-32 max-md:pb-20 h-[calc(100vh-8rem)]">
          {/* Profile Card */}
          {userInfo && (
            <GridItem
              area="md:[grid-area:1/1/2/5]"
              icon={
                <User2 className="h-4 w-4 text-black dark:text-neutral-400" />
              }
              title={userInfo.displayName || userInfo.username}
              description={`${userInfo.department?.name || "No department"} · ${
                userInfo.role
              }`}
              path={`/profile`}
            />
          )}

          {/* Quick Action 1 */}
          <GridItem
            area="md:[grid-area:1/5/2/9]"
            icon={<Crown className="h-4 w-4 text-blue-600" />}
            title="Flow Management"
            description="Meminta request dengan kategory flow yang telah dibuat"
            path={"/management/product"}
          />

          {/* Quick Action 2 */}
          <GridItem
            area="md:[grid-area:1/9/2/13]"
            icon={<Package className="h-4 w-4 text-yellow-600" />}
            title="New Transaction"
            description="Buat Transaksi Baru"
            path={"/request"}
          />

          {/* Quick Action 3 */}
          <GridItem
            area="md:[grid-area:2/1/3/7]"
            icon={<History className="h-4 w-4 text-green-600" />}
            title="Lihat Semua Transaksi"
            description="Lihat semua yang telah dibuat di sini"
            path={"/process"}
          />

          {/* Static card 1 */}
          <GridItem
            area="md:[grid-area:2/7/3/10]"
            icon={
              <ShieldCheck className="h-4 w-4 text-black dark:text-neutral-400" />
            }
            title="Supertenant Menu"
            description="Konfigurasi Organisasi dan SMTP"
            path={"/super/organization"}
          />

          {/* Static card 2 */}
          <GridItem
            area="md:[grid-area:2/10/3/13]"
            icon={
              <Building2 className="h-4 w-4 text-black dark:text-neutral-400" />
            }
            title="IT Department Card"
            description="Khusus untuk departemen IT dan pengelola sistem."
            path={"/management/customer"}
          />
        </ul>
      </div>
    </BackgroundBeamsWithCollision>
  );
};

export default Home;
