module.exports = {
  apps: [
    {
      name: 'mst-scanner',
      script: 'dist/main.js',
      wait_ready: true,
      kill_timeout: 300000,
    },
  ],
};
