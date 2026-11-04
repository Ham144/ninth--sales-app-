import { useEffect } from "react";
import { navigate } from "../lib/router.jsx";

export default function TechnicalPage() {
  useEffect(() => {
    navigate("/docs?ai=technical");
  }, []);
  return null;
}
