// https://github.com/rhvall/MinaDevContainer
// Based on code from https://github.com/rhvall/04-zkapp-browserui
// Origianl tutorial: https://docs.minaprotocol.com/zkapps/tutorials/zkapp-ui-with-react
// June 2023
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

/* eslint @typescript-eslint/no-var-requires: "off" */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,

  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      snarkyjs: require('path').resolve('node_modules/snarkyjs'),
    };
    config.experiments = {
      topLevelAwait: true,
    };
    config.optimization.minimizer = [];
    return config;
  },
  // To enable SnarkyJS for the web, we must set the COOP and COEP headers.
  // See here for more information: https://docs.minaprotocol.com/zkapps/how-to-write-a-zkapp-ui#enabling-coop-and-coep-headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  basePath:
    process.env.NODE_ENV === 'production' ? '/04-zkapp-browserui' : undefined, // update if your repo name changes for 'npm run deploy' to work successfully
  assetPrefix:
    process.env.NODE_ENV === 'production' ? '/04-zkapp-browserui/' : undefined, // update if your repo name changes for 'npm run deploy' to work successfully
};

module.exports = nextConfig;
