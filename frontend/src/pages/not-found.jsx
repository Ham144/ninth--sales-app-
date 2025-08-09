import React from "react";
import { Search } from "lucide-react";

const NotFound = () => {
	return (
		<div className="flex flex-col items-center justify-center h-screen shadow-lg shadow-slate-700/50 rounded-lg p-4 animate-pulse">
			<div className="text-9xl font-bold">404</div>
			<div className="text-3xl font-medium mt-4">
				Halaman Yang Kamu Akses Tidak Terdaftar
			</div>
			<div className="mt-10">
				<Search className="text-8xl animate-pulse" />
			</div>
		</div>
	);
};

export default NotFound;
