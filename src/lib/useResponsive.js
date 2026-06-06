/* useResponsive — tiny viewport hook so inline-styled components can switch
   layouts on mobile (inline styles can't use CSS media queries). */
import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 760) {
  const get = () => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const onResize = () => setMobile(get());
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}
