import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Next 15.5 rompe al concatenar dos módulos "use client" que se importan
    // entre sí: ConcatenationScope.matchModuleReference hace JSON.parse("") y
    // el build falla con "Unexpected end of JSON input".
    // Apagamos el scope hoisting hasta poder volver a Next 16.
    config.optimization.concatenateModules = false;
    return config;
  },
};

export default nextConfig;
