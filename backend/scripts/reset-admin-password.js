const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'admin123';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;

  console.log(`Génération du hash pour le mot de passe: ${password}`);
  console.log(`Nombre de rounds bcrypt: ${rounds}`);

  const hash = await bcrypt.hash(password, rounds);

  console.log('\n=== Hash généré ===');
  console.log(hash);

  console.log('\n=== Commande SQL pour mettre à jour le mot de passe ===');
  console.log(`UPDATE admin_users SET password_hash = '${hash}' WHERE username = 'admin';`);

  console.log('\n=== Pour Docker ===');
  console.log(`docker exec -it drive-ooblik-db psql -U ooblik -d drive_ooblik -c "UPDATE admin_users SET password_hash = '${hash}' WHERE username = 'admin';"`);
}

generateHash().catch(console.error);