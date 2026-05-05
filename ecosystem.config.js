module.exports = {
  apps: [
    {
      name: "backend",
      script: "src/app.js", // 🔥 change if needed
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};