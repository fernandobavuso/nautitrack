import { useState, useEffect } from "react";

// Hook que detecta el tamaño de pantalla
// Devuelve: isMobile (<768px), isTablet (768-1024px), isDesktop (>1024px)
export function useResponsive() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    width,
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1200,
    isDesktop: width >= 1200,
  };
}
