const withImages = require('next-images');

nextConfig = {
  images: {
    domains: [
      'playible-api-production.s3.ap-southeast-1.amazonaws.com',
      'playible-game-image.s3-ap-southeast-1.amazonaws.com',
      'playible-game-image.s3.ap-southeast-1.amazonaws.com',
      'playible-api-dev.s3.ap-southeast-1.amazonaws.com'
    ],
  },
  env: {
    NEAR_ENV: process.env.NEAR_ENV,
    GRAPHQL_URL: process.env.GRAPHQL_URL,
    ADMIN: process.env.ADMIN,
  },
};

module.exports = withImages(nextConfig);
