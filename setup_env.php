<?php
// setup_env.php - Akses file ini sekali via browser untuk membuat .env
// HAPUS file ini setelah .env terbuat!
$envContent = "DB_HOST=153.92.15.11\nDB_NAME=u589050364_analisasaham\nDB_USER=u589050364_analisasaham\nDB_PASS=Suluh@112358\nDB_PORT=3306\nDB_CHARSET=utf8mb4\n";
$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    echo ".env sudah ada. Tidak perlu setup lagi.\n";
    echo "Hapus file setup_env.php ini untuk keamanan.\n";
    exit;
}
if (file_put_contents($envPath, $envContent)) {
    echo ".env berhasil dibuat!\n";
    echo "Sekarang hapus file setup_env.php ini untuk keamanan.\n";
} else {
    echo "Gagal membuat .env. Periksa permission folder.\n";
}
