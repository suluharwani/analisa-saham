<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once __DIR__ . '/../config.php';
$code = isset($_GET['code']) ? $_GET['code'] : '';
if (!$code) { http_response_code(400); echo json_encode(['error'=>'code required']); exit; }
try {
    $sql = "SELECT code, name, sector, tanggal_harga AS date, harga AS price, jumlah_saham AS shares,
            market_cap AS mcap, total_aset AS assets, total_liabilitas AS liab, ekuitas AS equity,
            bvps, pbv, diskon AS disc, kategori, laba_bersih AS laba, eps, graham_number AS graham,
            klasifikasi AS klas, fair_value AS fairValue, upside, currency,
            catatan_khusus, riwayat_kasus, parent_company
            FROM companies WHERE code = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$code]);
    $row = $stmt->fetch();
    if (!$row) { http_response_code(404); echo json_encode(['error'=>'not found']); exit; }
    // directors
    $dstmt = $pdo->prepare("SELECT name, position FROM directors WHERE company_id = (SELECT id FROM companies WHERE code = ?)");
    $dstmt->execute([$code]);
    $row['directors'] = $dstmt->fetchAll();
    // shareholders
    $sstmt = $pdo->prepare("SELECT name, percentage, shares FROM shareholders WHERE company_id = (SELECT id FROM companies WHERE code = ?)");
    $sstmt->execute([$code]);
    $row['shareholders'] = $sstmt->fetchAll();
    echo json_encode($row);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
