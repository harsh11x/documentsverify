const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require("next/constants");

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {};

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...nextConfig,
      distDir: ".next-dev"
    };
  }

  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {
    return {
      ...nextConfig,
      distDir: ".next-build"
    };
  }

  return nextConfig;
};
