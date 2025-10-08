import React from "react";
import { APP_NAME } from "@/api/constant";
import { useUserInfo } from "@/store";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import {
  History,
  Package,
  User2,
  ShieldCheck,
  Logs,
  Download,
} from "lucide-react";
import GridItem from "@/components/ui/GridItem";

const Home = () => {
  const { userInfo } = useUserInfo();

  return (
    <BackgroundBeamsWithCollision
      className={"flex flex-col py-20 overflow-y-hidden"}
    >
      <h2 className="text-4xl relative z-20 md:text-4xl lg:text-7xl font-bold text-center text-black dark:text-white font-sans tracking-tight">
        <div className="relative mx-auto inline-block w-max [filter:drop-shadow(0px_1px_3px_rgba(27,_37,_80,_0.14))] ">
          <div className="absolute left-0 top-[1px] bg-clip-text bg-no-repeat text-transparent bg-gradient-to-r py-4 from-purple-500 via-violet-500 to-pink-500 [text-shadow:0_0_rgba(0,0,0,0.1)]">
            <span className="">{APP_NAME}.</span>
          </div>
          <div className="relative bg-clip-text text-transparent bg-no-repeat bg-gradient-to-r from-purple-500 via-violet-500 to-pink-500 py-4">
            <span className="">{APP_NAME}.</span>
          </div>
        </div>
      </h2>
      <div className="relative container h-full ">
        <ul className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 h-[calc(100vh-8rem)] overflow-y-auto pb-32">
          {/* Profile Card */}
          {userInfo && (
            <GridItem
              icon={<User2 className="h-5 w-5 text-primary" />}
              title={userInfo.displayName || userInfo.username}
              description={`${userInfo?.description || "APP User"} · ${
                userInfo.role
              }`}
              path="/profile"
            />
          )}
          {/* Quick Actions */}
          <GridItem
            icon={<Package className="h-5 w-5 text-yellow-600" />}
            title="New Transaction"
            description="Buat Transaksi Baru"
            path="/request"
            disabled={userInfo?.description === "OVERDUE"}
          />
          <GridItem
            icon={<History className="h-5 w-5 text-green-600" />}
            title="Proceed Sales Order"
            description="Melihat Sales Order yang dibuat oleh saya"
            path="/process"
            disabled={userInfo?.description === "OVERDUE"}
          />

          <GridItem
            icon={<Logs className="h-5 w-5 text-neutral-500" />}
            title="Overdue Page"
            description="Lihat daftar Overdue hanya untuk description OVERDUE"
            path="/overdue/list"
            disabled={userInfo?.description?.startsWith("SALES")}
          />
          <GridItem
            icon={<Logs className="h-5 w-5 text-neutral-500" />}
            title="Hutang-Piutang Page"
            description="Manage dan lihat Hutang Piutang"
            path="/utang-piutang"
            disabled={true}
          />
          <GridItem
            icon={<ShieldCheck className="h-5 w-5 text-neutral-500" />}
            title="IT Menu"
            description="Mengatur Konfigurasi dan Data Master"
            path="/management/customer"
            disabled={userInfo?.description != "IT"}
          />
          <GridItem
            icon={<Download className="h-5 w-5 text-neutral-500" />}
            title="Download Data"
            description="Mendownload data rangkukam sales order menjadi csv"
            path="/download/data"
          />
        </ul>
      </div>
    </BackgroundBeamsWithCollision>
  );
};

export default Home;