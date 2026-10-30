import { useEffect, useState } from "react";

function currentHref() {
  return window.location.pathname + window.location.search;
}

export function useRoute() {
  const [href, setHref] = useState(currentHref);

  useEffect(() => {
    const onPop = () => setHref(currentHref());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const qIndex = href.indexOf("?");
  const path = qIndex === -1 ? href : href.slice(0, qIndex);
  const search = qIndex === -1 ? "" : href.slice(qIndex);

  return { path, search, href };
}

/** @deprecated prefer useRoute */
export function usePath() {
  return useRoute().path;
}

export function navigate(to) {
  if (to === currentHref()) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Link({ to, children, className = "", exact = false }) {
  const { path } = useRoute();
  const targetPath = to.split("?")[0];
  const active = exact
    ? path === targetPath
    : path === targetPath || (targetPath !== "/" && path.startsWith(targetPath));
  return (
    <a
      href={to}
      className={`${className}${active ? " active" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
