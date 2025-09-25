// Configuration PM2 pour Drive Ooblik
module.exports = {
  apps: [{
    name: 'drive-ooblik-api',
    script: 'backend/src/app.js',
    cwd: process.env.HOME + '/drive-ooblik',

    // Configuration du processus
    instances: 'max', // Utiliser tous les CPU disponibles
    exec_mode: 'cluster',

    // Variables d'environnement
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    // Logs
    error_file: process.env.HOME + '/drive-ooblik/logs/api-error.log',
    out_file: process.env.HOME + '/drive-ooblik/logs/api-out.log',
    log_file: process.env.HOME + '/drive-ooblik/logs/api.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Gestion mémoire
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',

    // Restart automatique
    autorestart: true,
    watch: false, // Désactivé en production
    max_restarts: 10,
    min_uptime: '10s',

    // Configuration avancée
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000,

    // Health check
    health_check_url: 'http://localhost:3001/health',

    // Cron pour nettoyer les logs (tous les jours à 2h du matin)
    cron_restart: '0 2 * * *'
  }],

  // Configuration de déploiement (optionnel)
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-server.com'],
      ref: 'origin/deploy/vps',
      repo: 'https://github.com/your-username/drive-ooblik.git',
      path: '/home/ubuntu/drive-ooblik-deploy',
      'post-deploy': 'cd backend && npm install --production && npm run migrate && cd .. && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save'
    }
  }
};